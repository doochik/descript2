/* eslint-env mocha */

var expect = require( 'expect.js' );

var de = require( '../lib/index.js' );

var helpers = require( './_helpers.js' );

//  ---------------------------------------------------------------------------------------------------------------  //

describe( 'options.deps', function() {

    it( 'block depends on another block', function( done ) {
        var foo;

        var b1 = de.func( {
            block: helpers.wrap( function() {
                foo = 42;

                return 24;
            }, 50 )
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                return foo;
            } ),
            options: {
                deps: b1
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 24, 42 ] );

                done();
            } );
    } );

    it( 'block depends on another block (array)', function( done ) {
        var foo;

        var b1 = de.func( {
            block: helpers.wrap( function() {
                foo = 42;

                return 24;
            }, 50 )
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                return foo;
            } ),
            options: {
                deps: [ b1 ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 24, 42 ] );

                done();
            } );
    } );

    it( 'block depends on another block by id', function( done ) {
        var foo;

        var b1 = de.func( {
            block: helpers.wrap( function() {
                foo = 42;

                return 24;
            }, 50 ),
            options: {
                id: 'b1'
            }
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                return foo;
            } ),
            options: {
                deps: 'b1'
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 24, 42 ] );

                done();
            } );
    } );

    it( 'block depends on another block by id (array)', function( done ) {
        var foo;

        var b1 = de.func( {
            block: helpers.wrap( function() {
                foo = 42;

                return 24;
            }, 50 ),
            options: {
                id: 'b1'
            }
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                return foo;
            } ),
            options: {
                deps: [ 'b1' ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 24, 42 ] );

                done();
            } );
    } );

    it( 'block depends on several blocks', function( done ) {
        var values = [ 'one', 'two', 'three' ];

        var result = [];
        var blocks = values.map( function( value, i ) {
            return de.func( {
                block: helpers.wrap( function() {
                    result[ i ] = value;
                }, 50 + 50 * i )
            } );
        } );

        var block = de.func( {
            block: helpers.wrap( function() {
                return result;
            } ),
            options: {
                deps: blocks
            }
        } );

        var context = helpers.context();
        context.run( {
            foo: blocks,
            bar: block
        } )
            .then( function( result ) {
                expect( result.bar ).to.be.eql( values );

                done();
            } );
    } );

    it( 'chain of deps', function( done ) {
        var bar_value;
        var quu_value;

        var foo = de.func( {
            block: helpers.wrap( function() {
                bar_value = 'bar';

                return 'foo';
            }, 50 )
        } );

        var bar = de.func( {
            block: helpers.wrap( function() {
                quu_value = 'quu';

                return bar_value;
            }, 50 ),
            options: {
                deps: foo
            }
        } );

        var quu = de.func( {
            block: helpers.wrap( function() {
                return quu_value;
            }, 50 ),
            options: {
                deps: bar
            }
        } );

        var context = helpers.context();
        context.run( [ foo, bar, quu ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 'foo', 'bar', 'quu' ] );

                done();
            } );
    } );

    it( 'block depends on array', function( done ) {
        var v1;
        var v2;

        var b1 = de.func( {
            block: helpers.wrap( function() {
                v1 = 'foo';

                return v1;
            }, 50 )
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                v2 = 'bar';

                return v2;
            }, 100 )
        } );

        var b3 = de.func( {
            block: helpers.wrap( function() {
                return [ v1, v2 ];
            }, 50 ),
            options: {
                deps: [ b1, b2 ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2, b3 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 'foo', 'bar', [ 'foo', 'bar' ] ] );

                done();
            } );
    } );

    it( 'block depends on non-existent block #1', function( done ) {
        var block = de.func( {
            block: helpers.wrap( 42 ),
            options: {
                deps: 'another_block'
            }
        } );

        var context = helpers.context();
        context.run( block )
            .then( function( result ) {
                expect( result ).to.be.a( de.Error );
                expect( result.error.id ).to.be.eql( de.Error.ID.DEPS_NOT_RESOLVED );

                done();
            } );
    } );

    it( 'block depends on result of a function block', function( done ) {
        var v1;

        var b1 = de.func( {
            block: function() {
                return de.func( {
                    block: helpers.wrap( function() {
                        v1 = 24;

                        return 42;
                    }, 50 ),
                    options: {
                        id: 'b1'
                    }
                } );
            }
        } );

        var b2 = de.func( {
            block: helpers.wrap( function() {
                return v1;
            } ),
            options: {
                deps: 'b1'
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [ 42, 24 ] );

                done();
            } );
    } );

    it( 'block depends on non-existent block #2', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( 42, 50 )
        } );
        var b2 = de.func( {
            block: helpers.wrap( 24, 100 )
        } );
        var b3 = de.func( {
            block: helpers.wrap( 66 ),
            options: {
                deps: 'b4'
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2, b3 ] )
            .then( function( result ) {
                expect( result[ 0 ] ).to.be.eql( 42 );
                expect( result[ 1 ] ).to.be.eql( 24 );
                expect( result[ 2 ] ).to.be.a( de.Error );
                expect( result[ 2 ].error.id ).to.be.eql( de.Error.ID.DEPS_NOT_RESOLVED );

                done();
            } );
    } );

    it( 'block depends on a block resolved with an error', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( de.error( de.Error.ID.UNKNOWN_ERROR ), 50 )
        } );
        var b2 = de.func( {
            block: helpers.wrap( 24 ),
            options: {
                deps: b1
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result[ 0 ] ).to.be.a( de.Error );
                expect( result[ 0 ].error.id ).to.be.eql( de.Error.ID.UNKNOWN_ERROR );
                expect( result[ 1 ] ).to.be.a( de.Error );
                expect( result[ 1 ].error.id ).to.be.eql( de.Error.ID.DEPS_ERROR );
                expect( result[ 1 ].error.parent.error.id ).to.be.eql( de.Error.ID.UNKNOWN_ERROR );

                done();
            } );
    } );

    it( 'block depends on 2 blocks one of them resolved with an error', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( de.error( de.Error.ID.UNKNOWN_ERROR ), 50 )
        } );
        var b2 = de.func( {
            block: helpers.wrap( 42, 100 )
        } );
        var b3 = de.func( {
            block: helpers.wrap( 24 ),
            options: {
                deps: [ b1, b2 ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2, b3 ] )
            .then( function( result ) {
                expect( result[ 0 ] ).to.be.a( de.Error );
                expect( result[ 0 ].error.id ).to.be.eql( de.Error.ID.UNKNOWN_ERROR );
                expect( result[ 1 ] ).to.be.eql( 42 );
                expect( result[ 2 ] ).to.be.a( de.Error );
                expect( result[ 2 ].error.id ).to.be.eql( de.Error.ID.DEPS_ERROR );
                expect( result[ 2 ].error.parent.error.id ).to.be.eql( de.Error.ID.UNKNOWN_ERROR );

                done();
            } );
    } );

    it( 'block inherits parent state', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( {
                foo: 42
            }, 50 ),
            options: {
                after: function( params, context, state ) {
                    state.bar = 24;
                }
            }
        } );
        var b2 = de.func( {
            block: helpers.wrap( function( params, context, state ) {
                return state;
            }, 50 ),
            options: {
                deps: b1
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result ).to.be.eql( [
                    { foo: 42 },
                    { bar: 24 }
                ] );

                done();
            } );
    } );

    it( 'pre_conditions', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( {
                foo: 42
            }, 10 ),
            options: {
                //  id: 'foo',
                select: {
                    foo: de.jexpr( '.foo' )
                }
            }
        } );
        var b2 = de.func( {
            block: helpers.wrap( {
                bar: 24
            }, 20 ),
            options: {
                //  id: 'bar',
                select: {
                    bar: de.jexpr( '.bar' )
                }
            }
        } );
        var b3 = de.func( {
            block: helpers.wrap( function( params, context, state ) {
                return state;
            }, 10 ),
            options: {
                //  id: 'quu',
                deps: [
                    de.jexpr( 'state.foo && state.bar' )
                ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2, b3 ] )
            .then( function( result ) {
                expect( result[ 2 ] ).to.be.eql( {
                    foo: 42,
                    bar: 24
                } );

                done();
            } );
    } );

    it( 'failed pre_conditions #1', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( {
                foo: 42
            }, 10 ),
            options: {
                select: {
                    foo: de.jexpr( '.foo' )
                }
            }
        } );
        var b2 = de.func( {
            block: helpers.wrap( function( params, context, state ) {
                return state;
            }, 10 ),
            options: {
                deps: [
                    de.jexpr( 'state.bar' )
                ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2 ] )
            .then( function( result ) {
                expect( result[ 0 ] ).to.be.eql( { foo: 42 } );
                expect( result[ 1 ] ).to.be.a( de.Error );
                expect( result[ 1 ].error.id ).to.be.eql( de.Error.ID.DEPS_NOT_RESOLVED );

                done();
            } );
    } );

    it( 'failed pre_conditions #2', function( done ) {
        var b1 = de.func( {
            block: helpers.wrap( {
                quu: 42
            }, 10 ),
            options: {
                select: {
                    quu: de.jexpr( '.quu' )
                }
            }
        } );
        var b2 = de.func( {
            block: helpers.wrap( function( params, context, state ) {
                return state;
            }, 10 ),
            options: {
                deps: [
                    de.jexpr( 'state.foo' )
                ]
            }
        } );
        var b3 = de.func( {
            block: helpers.wrap( function( params, context, state ) {
                return state;
            }, 10 ),
            options: {
                deps: [
                    de.jexpr( 'state.bar' )
                ]
            }
        } );

        var context = helpers.context();
        context.run( [ b1, b2, b3 ] )
            .then( function( result ) {
                expect( result[ 0 ] ).to.be.eql( { quu: 42 } );
                expect( result[ 1 ] ).to.be.a( de.Error );
                expect( result[ 1 ].error.id ).to.be.eql( de.Error.ID.DEPS_NOT_RESOLVED );
                expect( result[ 2 ] ).to.be.a( de.Error );
                expect( result[ 2 ].error.id ).to.be.eql( de.Error.ID.DEPS_NOT_RESOLVED );

                done();
            } );
    } );

    it( 'two blocks with the same id', function( done ) {
        let run_count = 0;
        let before_count = 0;
        let after_count = 0;

        const AUTH = {
            auth: true,
        };

        const session = de.func( {
            block: helpers.wrap( function() {
                run_count++;

                return AUTH;
            }, 10 ),

            options: {
                id: 'session',

                before: function() {
                    before_count++;
                },

                after: function() {
                    after_count++;
                },
            },
        } );

        const page = {
            session: session,

            foo: {
                session: session,

                foo: de.func( {
                    block: helpers.wrap( 'foo', 20 ),

                    options: {
                        deps: 'session',
                    },
                } ),
            },

            bar: {
                session: session,

                foo: de.func( {
                    block: helpers.wrap( 'bar', 30 ),

                    options: {
                        deps: 'session',
                    },
                } ),
            },
        };

        const context = helpers.context();
        context.run( page )
            .then( function( result ) {
                expect( run_count ).to.be( 1 );
                expect( before_count ).to.be( 1 );
                expect( after_count ).to.be( 1 );
                expect( result.foo.session ).to.be( AUTH );
                expect( result.foo.session ).to.be( AUTH );

                done();
            } );
    } );

} );

