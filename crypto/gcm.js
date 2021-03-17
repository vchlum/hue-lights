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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const bytes = Me.imports.crypto.bytes;
const blocks = Me.imports.crypto.blocks;
const aes = Me.imports.crypto.aes;

function ghash(input, hashSubKey) {
    let result = blocks.createZeroBlock(16);

    for(let i = 0; i < input.length; i += 16) {
        result = blocks.multiply(blocks.exclusiveOR(
            result,
            input.slice(i, Math.min(i + 16, input.length))),
            hashSubKey
        );
    }

    return result;
};

function gctr(input, initialCounterBlock, key) {
    let counterBlock = initialCounterBlock;
    let output = [];

    if(0 === input.length) {
        return input;
    }

    let n = Math.ceil(input.length / 16);

    for(let i = 0; i < n; i++) {
        let y = blocks.exclusiveOR(
            input.slice(i * 16, Math.min((i + 1) * 16, input.length)),
            aes.encrypt(counterBlock, key)
        );

        for(let j = 0; j < y.length; j++) {
            output.push(y[j]);
        }

        if(i + 1 < n) {
            counterBlock = blocks.incrementLeastSignificantThirtyTwoBits(counterBlock);
        }
    }

    return output;
  };

function authenticatedEncryption(plainText, additionalAuthenticatedData, initializationVector, key) {
    let preCounterBlock;
    let cipherText;
    let plainTag;
    let hashSubKey = aes.encrypt(blocks.createZeroBlock(16), key);

    preCounterBlock = [].concat(initializationVector);
    if(12 === initializationVector.length) {
        preCounterBlock = preCounterBlock.concat(blocks.createZeroBlock(3)).concat([0x01]);
    } else {
        if(0 !== initializationVector.length % 16) {
            preCounterBlock = preCounterBlock.concat(blocks.createZeroBlock(16 - (initializationVector.length % 16)));
        }

      preCounterBlock = preCounterBlock.concat(blocks.createZeroBlock(8));

      preCounterBlock = ghash(preCounterBlock.concat(blocks.createZeroBlock(4)).concat(bytes.getBytes(initializationVector.length * 8)), hashSubKey);
    }

    cipherText = gctr(plainText, blocks.incrementLeastSignificantThirtyTwoBits(preCounterBlock), key);

    plainTag = additionalAuthenticatedData.slice();

    if(0 === additionalAuthenticatedData.length) {
        plainTag = plainTag.concat(blocks.createZeroBlock(16));
    } else if(0 !== additionalAuthenticatedData.length % 16) {
        plainTag = plainTag.concat(blocks.createZeroBlock(16 - (additionalAuthenticatedData.length % 16)));
    }

    plainTag = plainTag.concat(cipherText);

    if(0 === cipherText.length) {
        plainTag = plainTag.concat(blocks.createZeroBlock(16));
    } else if(0 !== cipherText.length % 16) {
        plainTag = plainTag.concat(blocks.createZeroBlock(16 - (cipherText.length % 16)));
    }

    plainTag = plainTag.concat(blocks.createZeroBlock(4))
        .concat(bytes.getBytes(additionalAuthenticatedData.length * 8))
        .concat(blocks.createZeroBlock(4)).concat(bytes.getBytes(cipherText.length * 8));

    return {
        cipherText: cipherText,
        authenticationTag: gctr(ghash(plainTag, hashSubKey), preCounterBlock, key)
    };
};

