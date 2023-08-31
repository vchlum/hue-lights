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

export var checkBit = function(byteArray, byteIndex, bitIndex) {
    return (byteArray[byteIndex] & (0x01 << bitIndex)) ? 1 : 0;
};
    
export var setBit = function(byteArray, byteIndex, bitIndex) {
    byteArray[byteIndex] = byteArray[byteIndex] | 0x01 << bitIndex;
};

export var resetBit = function(byteArray, byteIndex, bitIndex) {
    byteArray[byteIndex] = byteArray[byteIndex] & ~(0x01 << bitIndex);
};

export var getBytes = function(numericValue) {
    return [
      (numericValue & 0xFF000000) >>> 24,
      (numericValue & 0x00FF0000) >> 16,
      (numericValue & 0x0000FF00) >> 8,
      numericValue & 0x000000FF
    ];
};
