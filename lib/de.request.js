'use strict';

const url_ = require( 'url' );
const http_ = require( 'http' );
const https_ = require( 'https' );
const qs_ = require( 'querystring' );

//  ---------------------------------------------------------------------------------------------------------------  //

const no = require( 'nommon' );

const de = require( './de.js' );
require( './de.error.js' );

//  ---------------------------------------------------------------------------------------------------------------  //

const DEFAULT_OPTIONS = {
    method: 'GET',
    protocol: 'http:',
    host: 'localhost',
    path: '/',

    max_redirects: 0,
    max_retries: 0,
    is_retry_allowed: function( status_code, headers ) {
        return (
            status_code === 408 ||
            status_code === 500 ||
            ( status_code >= 502 && status_code <= 504 )
        );
    }
};

const _agents = new WeakMap();

//  ---------------------------------------------------------------------------------------------------------------  //

/*
function in_ms( start ) {
    return ' in ' + ( Date.now() - start ) + 'ms';
}

function total() {
    let total = in_ms( start_req );
    if ( retries || redirects ) {
        total += ' (';
        if ( retries ) {
            total += retries + ' ' + ( ( retries > 1 ) ? 'retries' : 'retry' );
        }
        if ( retries && redirects ) {
            total += ', ';
        }
        if ( redirects ) {
            total += redirects + ' ' + ( ( redirects > 1 ) ? 'redirects' : 'redirect' );
        }
        total += ')';
    }

    return total;
}
*/

//  ---------------------------------------------------------------------------------------------------------------  //

de.Request = function( options, context ) {
    this.options = no.extend( {}, DEFAULT_OPTIONS, options );
    this.context = context;
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.Request.prototype.start = function() {
    this.retries = 0;
    this.redirects = 0;

    this.max_retries = this.options.max_retries;
    this.max_redirects = this.options.max_redirects;
    this.is_retry_allowed = this.options.is_retry_allowed;

    this.visited_urls = {};

    this.timers = {
        start_req: Date.now()
    };

    this.promise = no.promise();

    this.promise.on( 'abort', ( e, reason ) => {
        if ( this.is_finished() ) {
            return;
        }

        let error;
        if ( de.is_error( reason ) ) {
            //  FIXME: Нужна ли тут эта ветка?
            error = reason;

        } else {
            error = {
                id: 'HTTP_REQUEST_ABORTED',
                reason: reason
            };
        }

        let log_message = 'ABORTED' + this.in_ms( this.timers.start_req );
        if ( reason ) {
            //  FIXME: Тут как-то не так должно быть.
            //  Если тут de.Error придет, например.
            //
            if ( typeof reason === 'object' ) {
                log_message += ': ' + JSON.stringify( reason );

            } else {
                log_message += ': ' + reason;
            }
        }
        this.context.error( log_message );

        this.done( de.error( error ) );
    } );

    this.do();

    return this.promise;
};

de.Request.prototype.done = function( result ) {
    if ( this.req ) {
        this.req.abort();
        this.req = null;
    }

    this.promise.resolve( result );
};

de.Request.prototype.do = function() {
    this.req = this.options.request_module.request( this.options.options, ( res ) => {
        this.result = {
            status_code: res.statusCode,
            headers: res.headers
        };

        this._buffers = [];
        this._received_length = 0;

        res.on( 'data', ( data ) => this._on_response_data( data ) );
        res.on( 'end', () => this._on_response_end() );
        res.on( 'close', ( error ) => this._on_response_close( error ) );
    } );

    this.req.on( 'error', ( error ) => this._on_request_error( error ) );

    if ( this.options.data ) {
        this.req.write( this.options.data );
    }

    this.req.end();
};

de.Request.prototype._on_response_data = function( data ) {
    this._buffers.push( data );
    this._received_length += data.length;
};

de.Request.prototype._on_response_end = function() {
    this.req = null;

    this.body = ( this._received_length ) ? Buffer.concat( this._buffers, this._received_length ) : null;
    this._buffers = null;

    const status_code = this.status_code;
    if ( ( status_code >= 301 && status_code <= 303 ) || status_code === 307 ) {
        this._do_redirect();

    } else if ( status_code >= 400 ) {
        this._do_retry();

    } else {
        this._log_response_end();
        this.done( this.result );
    }
};

de.Request.prototype._log_response_end = function() {
    this.context.info( this.status_code + this.total() + ' ' + this.url );
};

de.Request.prototype._on_response_close = function( error ) {
    if ( this.finished ) {
        return;
    }

    this._log_response_close( error );

    const result = {
        id: 'HTTP_CONNECTION_CLOSED',
        message: error.message
    };
    this.done( de.error( result ) );
};

de.Request.prototype._log_response_close = function( error ) {
    this.context.error( 'CONNECTION_CLOSED' + this.total() + ': ' + error.message );
};

de.Request.prototype._on_request_error = function( error ) {
    if ( this.finished ) {
        return;
    }

    this._log_request_error( error );

    const result = {
        id: 'HTTP_UNKNOWN_ERROR',
        message: error.message
    };
    this.done( de.error( result ) );
};

de.Request.prototype._log_request_error = function( error ) {
    this.context.error( 'UNKNOWN_ERROR' + this.total() + ': ' + error.message );
};

de.Request.prototype._do_redirect = function( redirect_url ) {
    if ( this.redirects < this.max_redirects ) {
        let redirect_url = this.headers[ 'location' ];

        //  FIXME: Проверять, что в redirect_url что-то есть.

        if ( !/^https?:\/\//.test( redirect_url ) ) {
            //  FIXME: А что будет, если тут redirect_url будет с ?...
            //  Будет ли он учтен в url.format?
            redirect_url = url_.format( {
                protocol: this.options.protocol,
                hostname: this.options.hostname,
                port: this.options.port,
                pathname: redirect_url
            } );
        }

        if ( this.visited_urls[ redirect_url ] ) {
            this.context.error( 'CYCLIC_REDIRECT' + this.total() + ' ' + this.url );
            this.done( de.error( {
                id: 'HTTP_CYCLIC_REDIRECT',
                message: 'Redirected to visited already url %url',
                url: redirect_url
            } ) );

            return;
        }

        this.context.debug( this.result.status_code + this.in_ms( this.timers.start ) + ' ' + this.url + ' ---> ' + redirect_url );

        const redirect_options = {
            url: redirect_url,
        };
        this.options = new Request.Options( redirect_options );

        this.redirects++;
        this.retries = 0;

        this.do();

    } else {
        this.context.info( this.result.status_code + this.total() + ' ' + this.options.url );
        this.done( this.result );
    }
};

de.Request.prototype.do_retry = function() {
    if ( this.retries < this.max_retries && this.is_retry_allowed( this.result.status_code, this.result.headers ) ) {
        let log_message = this.result.status_code + this.in_ms( this.timers.start );
        if ( this.result.body ) {
            log_message += ' ' + String( this.result.body );
        }
        log_message += ' ' + this.options.url;
        this.context.warn( log_message );

        this.retries++;

        this.do();

    } else {
        this.result.id = 'HTTP_' + this.result.status_code;
        this.result.message = http_.STATUS_CODES[ this.result.status_code ];

        let log_message = this.result.status_code + this.total();
        if ( this.result.body ) {
            log_message += ': ' + String( this.result.body );
        }
        log_message += ' ' + this.options.url;

        this.context.error( log_message );
        this.done( de.error( this.result ) );
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

//  FIXME: Оставшиеся опции:
//
//    * family
//    * localAddress
//    * socketPath
//    * auth
//    * createConnection
//
de.Request.Options = function( options ) {
    //  this.retries = options.retries;
    //  this.redirects = options.redirects;

    this.options = {};

    this.options.headers = {};
    if ( options.headers ) {
        for ( let name in options.headers ) {
            this.options.headers[ name.toLowerCase() ] = options.headers[ name ];
        }
    }

    if ( options.url ) {
        const parsed_url = url_.parse( options.url, true );
        const query = no.extend( parsed_url.query, options.query );

        this.options.protocol = parsed_url.protocol;
        this.options.hostname = parsed_url.hostname;
        this.options.port = Number( parsed_url.port );
        this.options.path = url_.format( {
            pathname: parsed_url.pathname,
            query: query
        } );

        //  pathname и query не используются при запросе,
        //  но используются для построения урла ниже.
        //
        this.options.pathname = parsed_url.pathname;
        this.options.query = query;

    } else {
        this.options.protocol = options.protocol;
        this.options.hostname = options.host;
        this.options.port = options.port;
        this.options.path = url_.format( {
            pathname: options.path,
            query: options.query
        } );

        this.options.pathname = options.path;
        this.options.query = options.query;
    }
    if ( !this.options.port ) {
        this.options.port = ( this.options.protocol === 'https:' ) ? 443 : 80;
    }

    this.url = url_.format( this.options );

    const method = this.options.method = options.method.toUpperCase();

    this.data = null;
    if ( options.body && ( method === 'POST' || method === 'PUT' || method === 'PATCH' ) ) {
        if ( Buffer.isBuffer( options.body ) ) {
            this.data = options.body;
            this._set_content_type( 'application/octet-stream' );

        } else if ( typeof options.body !== 'object' ) {
            this.data = String( options.body );
            this._set_content_type( 'text/plain' );

        } else if ( this.options.headers[ 'content-type' ] === 'application/json' ) {
            this.data = JSON.stringify( options.body );

        } else {
            this.data = qs_.stringify( options.body );
            this._set_content_type( 'application/x-www-form-urlencoded' );
        }

        this.options.headers[ 'content-length' ] = Buffer.byteLength( this.data );
    }

    if ( this.options.protocol === 'https:' ) {
        this.request_module = https_;

        this.options.pfx = options.pfx;
        this.options.key = options.key;
        this.options.passphrase = options.passphrase;
        this.options.cert = options.cert;
        this.options.ca = options.ca;
        this.options.ciphers = options.ciphers;
        this.options.rejectUnauthorized = options.rejectUnauthorized;
        this.options.secureProtocol = options.secureProtocol;
        this.options.servername = options.servername;

    } else {
        this.request_module = http_;
    }

    if ( options.agent != null ) {
        if ( typeof options.agent === 'object' && !( options.agent instanceof this.request_module.Agent ) ) {
            let agent = _agents.get( options.agent );
            if ( !agent ) {
                agent = new this.request_module.Agent( options.agent );
                _agents.set( options.agent, agent );
            }
            this.options.agent = agent;

        } else {
            //  Здесь может быть либо `false`, либо `instanceof Agent`.
            this.options.agent = options.agent;
        }
    }
};

de.Request.Options._set_content_type = function( content_type ) {
    if ( !this.options.headers[ 'content-type' ] ) {
        this.options.headers[ 'content-type' ] = content_type;
    }
};

//  ---------------------------------------------------------------------------------------------------------------  //

de.request = function( options, context ) {
    const req = new de.Request( options, context );

    return req.start();
};

//  ---------------------------------------------------------------------------------------------------------------  //

module.exports = de;

