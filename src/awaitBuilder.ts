﻿import references = require('references');
import assert = require('assert');
import _ = require('./util');
import internalState = require('./config/internalState');
import Builder = AsyncAwait.Await.Builder;
import Mod = AsyncAwait.Await.Mod;
import Handlers = AsyncAwait.Await.Handlers;
import HandlerOverrides = AsyncAwait.Await.HandlerOverrides;
export = awaitBuilder;


// Bootstrap a basic await builder using a no-op handler.
//TODO: need to work out appropriate 'base' functioanlity/behaviour here...
var awaitBuilder = createAwaitBuilder<Builder>(_.empty, {}, {
    singular: (fi, arg) => fi.resume(null, arg),
    variadic: (fi, args) => fi.resume(null, args[0])
});


/** Creates a new await builder function using the specified handler settings. */
function createAwaitBuilder<TBuilder extends Builder>(handlersFactory: (baseHandlers: Handlers, options: {}) => HandlerOverrides, options: {}, baseHandlers: Handlers) {

    // Instantiate the handlers by calling the provided factory function.
    var handlers: Handlers = <any> _.mergeProps({}, baseHandlers, handlersFactory(baseHandlers, options));

    // Create the builder function.
    var builder: TBuilder = <any> function await(arg) {

        //TODO: can this be optimised more, eg like async builder's eval?

        // Ensure this function is executing inside a fiber.
        var fi = _.currentFiber();
        assert(fi, 'await: may only be called inside a suspendable function');

        // TODO: temp testing... fast/slow paths
        if (arguments.length === 1) {

            // TODO: singular case...
            if (!Array.isArray(arg)) {
                var handlerResult = handlers.singular(fi, arg);
            }

            // TODO: single array case...
            else {
                //TODO: resultCallback should be defined in handlers...
                var numberResolved = 0, tgt = new Array(arg.length);
                var resultCallback = (err: Error, value: any, index: number) => {
                    if (err) {
                        //TODO:...
                        throw err;
                    }

                    tgt[index] = value;
                    if (++numberResolved === numberHandled) {

                        // TODO: fill remaining 'holes' in tgt, if any
                        if (numberHandled < arg.length) {
                            for (var i = 0, len = arg.length; i < len; ++i) {
                                if (!(i in tgt)) tgt[i] = arg[i];
                            }    
                        }

                        // TODO: restore fi state for next await
                        fi.awaiting = [];

                        // And finally we're done
                        fi.resume(null, tgt);
                            
                    }
                    
                };
                if (arg.length > 0) {
                    var numberHandled = handlers.elements(arg, resultCallback);

                    // TODO: this is a copy/paste from above AND below...
                    // TODO: fill remaining 'holes' in tgt, if any
                    if (numberHandled < arg.length) {
                        for (i = 0, len = arg.length; i < len; ++i) {
                            if (!(i in tgt)) tgt[i] = arg[i];
                        }
                        if (numberHandled === 0) {

                            //TODO: special case: empty array...
                            //TODO: need setImmediate?
                            setImmediate(() => {
                                fi.awaiting = [];
                                fi.resume(null, tgt);
                            });
                        }
                    }
                }
                else {
                    //TODO: special case: empty array...
                    //TODO: need setImmediate?
                    setImmediate(() => {
                        fi.awaiting = [];
                        fi.resume(null, tgt);
                    });
                }
            }
        }

        // TODO: variadic case...
        else {

            // Create a new array to hold the passed-in arguments.
            var len = arguments.length, allArgs = new Array(len);
            for (var i = 0; i < len; ++i) allArgs[i] = arguments[i];

            // Delegate to the specified handler to appropriately await the pass-in value(s).
            var handlerResult = handlers.variadic(fi, allArgs);
        }

        // Ensure the passed-in value(s) were handled.
        //TODO: ...or just pass back value unchanged (i.e. await.value(...) is the built-in fallback.
        assert(handlerResult !== _.notHandled, 'await: the passed-in value(s) are not recognised as being awaitable.');

        // Suspend the fiber until the await handler causes it to be resumed. NB: fi.suspend is bypassed here because:
        // 1. its custom handling is not appropriate for await, which always wants to simply suspend the fiber; and
        // 2. its custom handling is simplified by not needing to special-case calls from awaitBuilder.
        return _.yieldCurrentFiber();
    }

    // Tack on the handlers and options properties, and the mod() method.
    builder.handlers = handlers;
    builder.options = options;
    builder.mod = createModMethod(handlers, handlersFactory, options, baseHandlers);

    // Return the await builder function.
    return builder;
}


//TODO: review this method! use name? use type? clarity how overrides/defaults are used, no more 'factory'
/** Creates a mod() method appropriate to the given handler settings. */
function createModMethod(handlers, handlersFactory, options, baseHandlers) {
    return function mod(mod: Mod<Builder>) {

        // Validate the argument.
        assert(arguments.length === 1, 'mod: expected one argument');
        var hasHandlersFactory = !!mod.overrideHandlers;

        // Determine the appropriate options to pass to createAwaitBuilder.
        var opts = _.branch(internalState.options);
        _.mergeProps(opts, options, mod.defaults);

        // Determine the appropriate handlersFactory and baseHandlers to pass to createAwaitBuilder.
        var newHandlersFactory = hasHandlersFactory ? mod.overrideHandlers : handlersFactory;
        var newBaseHandlers = hasHandlersFactory ? handlers : baseHandlers;

        // Delegate to createAwaitBuilder to return a new async builder function.
        return createAwaitBuilder(newHandlersFactory, opts, newBaseHandlers);
    }
}
