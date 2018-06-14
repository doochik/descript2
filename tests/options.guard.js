/* eslint-env mocha */

var expect = require( 'expect.js' );

var de = require( '../lib/index.js' );

var helpers = require( './_helpers.js' );

var ERROR_ID = de.Error.ID.BLOCK_GUARDED;

//  ---------------------------------------------------------------------------------------------------------------  //

function create_block( block, options ) {
    return de.func( {
        block: block,
        options: options
    } );
}

//  ---------------------------------------------------------------------------------------------------------------  //

describe( 'options.guard', function() {

    it( 'guard is a function', function( done ) {
        var _params = { foo: true };
        var _context = helpers.context();
        const _state = {};

        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                id: 'first',
                guard: function( params, context, state ) {
                    expect( params ).to.be( _params );
                    expect( context ).to.be( _context );
                    expect( state ).to.be( _state );

                    return true;
                }
            }
        );

        _context.run( block, _params, _state )
            .then( function( result ) {
                expect( result ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'guard is a function returning false', function( done ) {
        var _params = { foo: true };
        var _context = helpers.context();

        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: function( params, context, state ) {
                    return false;
                }
            }
        );

        _context.run( block, _params )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'successful guard', function( done ) {
        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: de.jexpr( 'params.foo' )
            }
        );

        var context = helpers.context();
        context.run( block, { foo: true } )
            .then( function( result ) {
                expect( result ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'failed guard', function( done ) {
        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: de.jexpr( 'params.foo' )
            }
        );

        var context = helpers.context();
        context.run( block, { foo: false } )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'guard is an array #1', function( done ) {
        var _params = { id: 42 };
        var _context = helpers.context();
        const _state = {};
        var foo;

        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                id: 'first',
                guard: [
                    function( params, context, state ) {
                        expect( params ).to.be( _params );
                        expect( context ).to.be( _context );
                        expect( state ).to.be( _state );

                        expect( foo ).to.be( undefined );
                        foo = true;

                        return true;
                    },

                    function( params, context, state ) {
                        expect( params ).to.be( _params );
                        expect( context ).to.be( _context );
                        expect( state ).to.be( _state );

                        expect( foo ).to.be( true );

                        return true;
                    }
                ]
            }
        );

        _context.run( block, _params, _state )
            .then( function( result ) {
                expect( result ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'guard is an array #2', function( done ) {
        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: [
                    function( params, context, state ) {
                        return false;
                    },

                    function( params, context, state ) {
                        throw Error( 'error' );
                    }
                ]
            }
        );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'guard is an array #3', function( done ) {
        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: [
                    function( params, context, state ) {
                        return true;
                    },

                    function( params, context, state ) {
                        return false;
                    }
                ]
            }
        );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'guard is an array #4', function( done ) {
        var block = create_block(
            helpers.wrap( 'foo', 50 ),
            {
                guard: [
                    de.jexpr( 'params.foo == 42' ),
                    de.jexpr( 'params.bar == 24' )
                ]
            }
        );

        var context = helpers.context();
        context.run( block, { foo: 42, bar: 24 } )
            .then( function( result ) {
                expect( result ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'guard checks inherited state', function( done ) {
        var b1 = create_block(
            helpers.wrap( {
                id: 42
            }, 50 ),
            {
                select: {
                    id: de.jexpr( '.id' )
                }
            }
        );

        var b2 = create_block(
            helpers.wrap( 'foo' ),
            {
                deps: b1,
                guard: de.jexpr( 'state.id == 42' )
            }
        );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result[ 1 ] ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'guard and inherited guard #1', function( done ) {
        var foo;
        var b1 = create_block(
            helpers.wrap( 'foo' ),
            {
                guard: function( params, context, state ) {
                    expect( foo ).to.be( undefined );

                    foo = true;

                    return true;
                }
            }
        );

        var b2 = b1( {
            guard: function( params, context, state ) {
                expect( foo ).to.be( true );

                return true;
            }
        } );

        var context = helpers.context();
        context.run( b2 )
            .then( function( result ) {
                expect( result ).to.be( 'foo' );

                done();
            } );
    } );

    it( 'guard and inherited guard #2', function( done ) {
        var b1 = create_block(
            helpers.wrap( 'foo' ),
            {
                guard: function( params, context, state ) {
                    return false;
                }
            }
        );

        var b2 = b1( {
            guard: function( params, context, state ) {
                throw Error( 'error' );
            }
        } );

        var context = helpers.context();
        context.run( b2 )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'guard with error #1', function( done ) {
        const ERROR_ID = 'SOME_ERROR';

        const block = create_block(
            helpers.wrap( 'foo' ),
            {
                guard: function( params, context, state ) {
                    throw Error( ERROR_ID );
                }
            }
        );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.message ).to.be( ERROR_ID );

                done();
            } );
    } );

    it( 'guard with error #2', function( done ) {
        const block = create_block(
            helpers.wrap( 'foo' ),
            {
                guard: function( params, context, state ) {
                    //  eslint-disable-next-line
                    return noo.jpath( '.foo', state );
                }
            }
        );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( 'ReferenceError' );

                done();
            } );
    } );

    it( 'guard with error #3', function( done ) {
        const block = create_block(
            helpers.wrap( 'foo' ),
            {
                guard: function( params, context, state ) {
                    return state.foo.bar;
                }
            }
        );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be( 'TypeError' );

                done();
            } );
    } );

} );

