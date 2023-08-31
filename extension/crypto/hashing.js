'use strict';

/**
 * Source:
 * https://github.com/openilabs/crypto/tree/master/djcl
 * 
 */

/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 openilabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @namespace Hash functions
 * @author Anonymized
 * @description
 * <p>Hash functions and hashing.</p>
 * @requires encoding
 */
export var hashing = (function() {
    let sha256 = {
        name: 'sha-256',
        identifier: '608648016503040201',
        size: 32,
        block: 64,

        key: [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ],

        hash: function(input) {
            let s = input.slice(0, input.length);
            s.push(0x80);
            let len = s.length, blocks = len >> 6, chunck = len & 63,
            res = [], i = 0, j = 0, k = 0, l = 0,
            H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19],
            w = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

            while(chunck++ != 56) {
                s.push(0x00);
                if(chunck == 64){ blocks++; chunck = 0; }
            }

            for(s = s.concat([0x0,0x0,0x0,0x0]), chunck=3, len=8*(len-1); chunck >= 0; chunck--)
            s.push(len >> (8*chunck) &255);

            for(i=0; i < s.length; i++) {
                j = (j<<8) + s[i];
                if((i&3)==3){ w[(i>>2)&15] = j; j = 0; }
                if((i&63)==63) this._round(H,w);
            }

            for(i=0; i < H.length; i++)
                for(j=3; j >= 0; j--)
                    res.push(H[i] >> (8*j) & 255);

            return res;
        },

        _round: function(H,w) {
            let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4],
            f = H[5], g = H[6], h = H[7], t = 0, u = 0, v = 0, tmp = 0;

            for(t=0; t < 64; t++) {
                if(t < 16) tmp = w[t&15];
                else {
                    u = w[(t+1)&15]; v = w[(t+14)&15];
                    tmp = w[t&15] = ((u>>>7  ^ u>>>18 ^ u>>>3  ^ u<<25 ^ u<<14) +
                        (v>>>17 ^ v>>>19 ^ v>>>10 ^ v<<15 ^ v<<13) +
                        w[t&15] + w[(t+9)&15]) | 0;
                }

                tmp = (tmp + h + (e>>>6 ^ e>>>11 ^ e>>>25 ^ e<<26 ^ e<<21 ^ e<<7)
                    + (g ^ e & (f^g)) + this.key[t&63]);

                h = g; g = f; f = e; e = d + tmp | 0; d = c; c = b; b = a;
                a = (tmp + ((b&c) ^ (d&(b^c))) + (b>>>2 ^ b>>>13 ^ b>>>22 ^ b<<30 ^ b<<19 ^ b<<10)) | 0;
            }

            H[0]=H[0]+a|0; H[1]=H[1]+b|0; H[2]=H[2]+c|0; H[3]=H[3]+d|0;
            H[4]=H[4]+e|0; H[5]=H[5]+f|0; H[6]=H[6]+g|0; H[7]=H[7]+h|0;
        }
    };

    return {
        /** SHA-256 hash function wrapper. This object can be used
         * to configure primitives that rely on a hash function,
         * for instance hashing.hmac_hash = hashing.sha256
         */
        sha256: sha256,

        /** The hash function to use for HMAC, hashing.sha256 by default
         */
        hmac_hash: sha256,

        /** Hash-based message authentication code
         * @param {string} key key of the authentication
         * @param {string} msg message to authenticate
         * @returns {string} authentication code, as an hex string.
         */
        HMAC: function(k, msg) {
            let key = k.slice(0, k.length);
            let i = 0, h = this.hmac_hash,
                c = 0, p = '', inner = [], outer = [];

            if(key.length > h.block) key = h.hash(key);
            while(key.length < h.block) key.push(0x00);

            for(i=0; i < key.length; i++) {
                c = key[i];
                inner.push(c ^ 0x36);
                outer.push(c ^ 0x5C);
            }

            return h.hash(outer.concat(h.hash(inner.concat(msg))));
        }
    };
 })();

