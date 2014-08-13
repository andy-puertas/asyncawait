﻿var Fiber = require('fibers');

//TODO: apply this by default? Check impact on benchmarks.
/**
*  Automatically manages Fiber.poolSize to work around an issue with node-fibers.
*  This mod is recommended when the peak number of concurrently executing fibers
*  (there is one for each currently executing suspendable function) is likely to
*  exceed 120. Memory leaks and slowdowns under heavy load are symptomatic of the
*  issue fixed by this mod. See https://github.com/laverdet/node-fibers/issues/169.
*/
exports.mod = {
    name: 'fibersHotfix169',
    override: function (base, options) {
        // Override the joint protocol if the option is selected.
        return (!options.fibersHotfix169) ? null : {
            acquireFiber: function (asyncProtocol) {
                inc();
                return base.acquireFiber(asyncProtocol);
            },
            releaseFiber: function (asyncProtocol, fi) {
                dec();
                return base.releaseFiber(asyncProtocol, fi);
            },
            shutdown: function () {
                _fiberPoolSize = Fiber.poolSize;
                _activeFiberCount = 0;
                base.shutdown();
            }
        };
    },
    defaults: {
        fibersHotfix169: false
    }
};

/** Increment the number of active fibers. */
function inc() {
    ++_activeFiberCount;
    if (_activeFiberCount >= _fiberPoolSize) {
        _fiberPoolSize += 100;
        Fiber.poolSize = _fiberPoolSize;
    }
}

/** Decrement the number of active fibers. */
function dec() {
    --_activeFiberCount;
}

// Private state.
//TODO: should this be global, in case multiple asyncawait instances are loaded in the process?
var _fiberPoolSize = Fiber.poolSize;
var _activeFiberCount = 0;
//# sourceMappingURL=fibersHotfix169.js.map
