'use strict';

/**
 * Author: Taner Mansur
 * 
 * https://github.com/tmnsur/aes-gcm.js
 * 
 */

 /**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) Taner Mansur
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import * as bytes from './bytes.js';

export var createZeroBlock = function(length) {
    var result = [];

    for(let i = 0; i < length; i++) {
      result.push(0x00);
    }

    return result;
};

var R = [0xe1].concat(createZeroBlock(15));

export var exclusiveOR = function(block0, block1) {
    let result = [];

    for(let i = 0; i < block0.length; i++) {
        result[i] = block0[i] ^ block1[i];
    }

    return result;
};

var rightShift = function(block) {
    let carry = 0;
    let oldCarry = 0;

    for(let i = 0; i < block.length; i++) {
        oldCarry = carry;
        carry = block[i] & 0x01;
        block[i] = block[i] >> 1;

        if(oldCarry) {
            block[i] = block[i] | 0x80;
        }
    }

    return block;
}

export var multiply = function(block0, block1) {
    let v = block1.slice();
    let z = createZeroBlock(16);

    for(let i = 0; i < 16; i++) {
        for(let j = 7; j != -1; j--) {
            if(bytes.checkBit(block0, i, j)) {
                z = exclusiveOR(z, v);
            }

            if(bytes.checkBit(v, 15, 0)) {
                v = exclusiveOR(rightShift(v), R);
            } else {
                v = rightShift(v);
            }
        }
    }

    return z;
};

export var incrementLeastSignificantThirtyTwoBits = function(block) {
    let result = block.slice();
    for(let i = 15; i != 11; i--) {
        result[i] = result[i] + 1;

        if(256 === result[i]) {
            result[i] = 0;
        } else {
            break;
        }
    }

    return result;
};

export var createCompletingPart = function(partialBlock) {
    let result = [];
    let partialPartLength = partialBlock.length % 16;

    if(partialPartLength) {
        for(let i = 0; i < 16 - partialPartLength; i++) {
            result.push(0x00);
        }
    }

    return result;
};
