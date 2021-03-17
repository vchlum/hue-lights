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

function toHexChar(nibble) {
	if(nibble < 10) {
        return String.fromCharCode(48 + nibble);
    }
    return String.fromCharCode(87 + nibble);
}

function fromHexChar(hexChar) {
    if('9' < hexChar) {
        return hexChar.charCodeAt(0) - 87;
    }
  return hexChar.charCodeAt(0) - 48;
}

function toHex(byteArray) {
    let result = [];

    for(let i = 0; i < byteArray.length; i++) {
      result.push(toHexChar((byteArray[i] & 0xF0) >> 4));
      result.push(toHexChar(byteArray[i] & 0x0F));
    }

    return result.join('');
}

function fromHex(hex) {
    let result = [];

    for(let i = 0; i < hex.length; i += 2) {
      result.push((fromHexChar(hex[i]) << 4) | (fromHexChar(hex[i + 1])));
    }

    return result;
}