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

var SBox = [
    [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76],
    [0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0],
    [0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15],
    [0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75],
    [0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84],
    [0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf],
    [0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8],
    [0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2],
    [0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73],
    [0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb],
    [0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79],
    [0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08],
    [0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a],
    [0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e],
    [0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf],
    [0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16]
];

var Rcon = [
    [0x00, 0x00, 0x00, 0x00],
    [0x01, 0x00, 0x00, 0x00],
    [0x02, 0x00, 0x00, 0x00],
    [0x04, 0x00, 0x00, 0x00],
    [0x08, 0x00, 0x00, 0x00],
    [0x10, 0x00, 0x00, 0x00],
    [0x20, 0x00, 0x00, 0x00],
    [0x40, 0x00, 0x00, 0x00],
    [0x80, 0x00, 0x00, 0x00],
    [0x1b, 0x00, 0x00, 0x00],
    [0x36, 0x00, 0x00, 0x00]
];

function addRoundKey(state, roundKeyArray, offset) {
    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++) {
            state[i][j] = state[i][j] ^ roundKeyArray[offset + j][i];
        }
    }
}

function subBytes(state) {
    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++) {
            state[i][j] = SBox[(state[i][j] & 0xF0) >> 4][(state[i][j] & 0x0F)];
        }
    }
}

function subWord(value) {
    for(let i = 0; i < 4; i++) {
        value[i] = SBox[(value[i] & 0xF0) >> 4][(value[i] & 0x0F)];
    }
}

function rotWord(value) {
    let tmp = value[0];

    value[0] = value[1];
    value[1] = value[2];
    value[2] = value[3];
    value[3] = tmp;
}

function shiftRows(state) {
    let k;
    let l;
    let tmp;

    for(let i = 1; i < 4; i++) {
        for(let j = 0; j < ((i - 1) % 2) + 1; j++) {
            tmp = state[i][j];
            k = j;

            while(true) {
                l = k + i;

                if(l >= 4) {
                    l = l - 4;
                }

                if(l == j) {
                    break;
                }

                state[i][k] = state[i][l];
                k = l;
            }

            state[i][k] = tmp;
        }
    }
}

function finiteFieldMultiplication(value0, value1) {
    let result = 0;

    for(let i = 0; i < 8; i++) {
        if(0 !== (value1 & 1)) {
            result = result ^ value0;
        }

        if(0 !== (value0 & 0x80)) {
            value0 = value0 << 1;
            value0 = value0 ^ 0x11b;
        } else {
            value0 = value0 << 1;
        }

        value1 = value1 >> 1;
    }

    return result;
}

function mixColumns(state) {
    let tmp = [[],[],[],[]];

    for(let i = 0; i < 4; i++) {
        tmp[0][i] = finiteFieldMultiplication(0x02, state[0][i]) ^ finiteFieldMultiplication(0x03, state[1][i]) ^ state[2][i] ^ state[3][i];
        tmp[1][i] = state[0][i] ^ finiteFieldMultiplication(0x02, state[1][i]) ^ finiteFieldMultiplication(0x03, state[2][i]) ^ state[3][i];
        tmp[2][i] = state[0][i] ^ state[1][i] ^ finiteFieldMultiplication(0x02, state[2][i]) ^ finiteFieldMultiplication(0x03, state[3][i]);
        tmp[3][i] = finiteFieldMultiplication(0x03, state[0][i]) ^ state[1][i] ^ state[2][i] ^ finiteFieldMultiplication(0x02, state[3][i]);
    }

    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++) {
            state[i][j] = tmp[i][j];
        }
    }
}

function keyExpansion(roundLimit, key) {
    let nK = parseInt(key.length / 4);
    let result = [];
    let tmp;

    for(let i = 0; i < key.length; i++) {
        if(0 === i % 4) {
            result.push([]);
        }

        result[parseInt(i / 4)].push(key[i]);
    }

    for(let i = nK; i < 4 * roundLimit; i++) {
        result[i] = [];
        tmp = result[i - 1].slice();

        if(0 === i % nK) {
            rotWord(tmp);
            subWord(tmp);

            for(let j = 0; j < 4; j++) {
                tmp[j] = tmp[j] ^ Rcon[parseInt(i / nK)][j];
            }
        } else if(6 < nK && 4 === (i % nK)) {
            subWord(tmp);
        }

        for(let j = 0; j < 4; j++) {
            result[i][j] = result[i - nK][j] ^ tmp[j];
        }
    }

  return result;
}

export function encrypt(input, key) {
    let round;
    let roundLimit;
    let w;
    let state = [[],[],[],[]];
    let output = [];

    if(16 === key.length) {
        roundLimit = 11;
    } else if(24 === key.length) {
        roundLimit = 13;
    } else if(32 === key.length) {
        roundLimit = 15;
    } else {
        throw "illegal key length: " + key.length;
    }

    w = keyExpansion(roundLimit, key);

    for(let i = 0; i < 15; i++) {
        state[parseInt(i / 4)].push(input[(i * 4) % 15]);
    }

    state[3].push(input[15]);

    addRoundKey(state, w, 0);

    for(round = 1; round < roundLimit; round++) {
        subBytes(state);
        shiftRows(state);

        if(round + 1 < roundLimit) {
            mixColumns(state);
        }

        addRoundKey(state, w, round * 4);
    }

    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++) {
            output.push(state[j][i]);
        }
    }

  return output;
}


