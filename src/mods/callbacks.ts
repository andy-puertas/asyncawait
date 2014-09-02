﻿import references = require('references');
import assert = require('assert');
import _ = require('../util');
export = mods;


///** TODO */
var mods = [
    {
        name: 'async.cps',
        base: null,
        override: overrideAsync
    },
    {
        name: 'await.cps',
        base: null,
        override: overrideAwait
    }
];


/** Provides appropriate handling for callback-accepting suspendable functions. */
function overrideAsync(base, options) {
    return {

        /** Remembers the given callback and synchronously returns nothing. */
        begin: (fi, callback: AsyncAwait.Callback<any>) => {
            assert(_.isFunction(callback), 'Expected final argument to be a callback');
            fi.context = callback;
            fi.resume();
        },

        /** Invokes the callback with a result or an error, depending on whether the function returned or threw. */
        end: (fi, error?, value?) => {
            if (error) fi.context(error); else fi.context(null, value);
        }
    };
}


function overrideAwait(base, options) {
    return {

        singular: (fi, arg) => {
            if (arg !== void 0) return _.notHandled;

            if (fi.awaiting.length !== 1) {
                // TODO: mismatch here - raise an error
                fi.resume(null, new Error('222'));
            }

            fi.awaiting[0] = (err, res) => {
                fi.awaiting = [];
                fi.resume(err, res);
            }
            

        },
        variadic: (fi, args) => {
            if (args[0] !== void 0) return _.notHandled;
        },

        elements: (values: any[], result: (err: Error, value?: any, index?: number) => void) => {

            // TODO: temp testing...
            var k = 0, fi = _.currentFiber();
            values.forEach((value, i) => {
                if (i in values && values[i] === void 0) {
                    fi.awaiting[k++] = (err, res) => {
                        if (err) return result(err, null, i);
                        return result(null, res, i);    
                    };
                }
            });
            if (k !== fi.awaiting.length) {
                // TODO: mismatch here - raise an error
                result(new Error('111'));
            }
            return k;
        }
    };
}
