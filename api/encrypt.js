const crypto = require('crypto');

class HardObfuscator {
  constructor(code, expiryDays) {
    this.code = code;
    this.expiryDays = expiryDays;
  }

  toHexArray(str) {
    const hex = Buffer.from(str, 'utf8').toString('hex').match(/.{1,2}/g) || [];
    return '[' + hex.map(h => '0x' + h).join(',') + ']';
  }

  randomId(len = 8) {
    return crypto.randomBytes(len).toString('hex');
  }

  encodeStrings(code) {
    const stringPattern = /(["'])((?:(?=(\\?))\3.)*?)\1/g;
    const decodeFunc = `
      const _decode = (arr) => {
        let str = '';
        for(let i = 0; i < arr.length; i++) {
          str += String.fromCharCode(arr[i]);
        }
        return Buffer.from(str, 'hex').toString('utf8');
      };
    `;
    
    let encoded = code;
    let hasStrings = false;
    
    encoded = encoded.replace(stringPattern, (match, quote, content) => {
      hasStrings = true;
      const hexArr = this.toHexArray(content);
      return `_decode(${hexArr})`;
    });
    
    return hasStrings ? decodeFunc + encoded : encoded;
  }

  renameVars(code) {
    const varPattern = /\b(let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const funcPattern = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    
    let counter = 0;
    const mapping = new Map();
    const generateName = () => '_0x' + counter.toString(16) + '_' + this.randomId(4);
    
    let match;
    while ((match = varPattern.exec(code)) !== null) {
      if (!mapping.has(match[2])) {
        mapping.set(match[2], generateName());
        counter++;
      }
    }
    
    while ((match = funcPattern.exec(code)) !== null) {
      if (!mapping.has(match[1])) {
        mapping.set(match[1], generateName());
        counter++;
      }
    }
    
    let renamed = code;
    for (const [oldName, newName] of mapping) {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      renamed = renamed.replace(regex, newName);
    }
    
    return renamed;
  }

  flattenControlFlow(code) {
    const statements = code.split(';').filter(s => s.trim().length > 0);
    if (statements.length < 3) return code;
    
    const shuffled = [...statements];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const cases = [];
    for (let i = 0; i < shuffled.length; i++) {
      cases.push(`
        case ${i}: {
          ${shuffled[i]};
          _next = ${(i + 1) % shuffled.length};
          break;
        }
      `);
    }
    
    return `
      let _next = 0;
      const _handler = (function() {
        let _case = _next;
        while(true) {
          switch(_case) {
            ${cases.join('')}
            default: return;
          }
          _case = _next;
        }
      });
      _handler();
    `;
  }

  createDispatcher() {
    const names = [];
    const funcs = [];
    
    for (let i = 0; i < 20; i++) {
      const name = '_f_' + this.randomId(4);
      names.push(name);
      funcs.push(`
        const ${name} = (function() {
          let _r = ${Math.floor(Math.random() * 1000)};
          return function(..._a) {
            _r = (_r * 9301 + 49297) % 233280;
            return _r / 233280;
          };
        })();
      `);
    }
    
    return `
      ${funcs.join('\n')}
      const _dispatch = (function() {
        const _m = [${names.join(',')}];
        return function(_i, ..._args) {
          return _m[_i % _m.length](..._args);
        };
      })();
    `;
  }

  createSelfDefending() {
    return `
      (function() {
        const _stack = new Error().stack;
        if(_stack && (_stack.includes('eval') || _stack.includes('Function') || _stack.includes('debugger'))) {
          const _err = new Error();
          _err.name = 'SecurityError';
          _err.message = 'Code tampering detected';
          throw _err;
        }
      })();
    `;
  }

  createAntiDebug() {
    return `
      (function() {
        let _dbCheck = 0;
        setInterval(function() {
          _dbCheck++;
          const _start = Date.now();
          debugger;
          const _end = Date.now();
          if((_end - _start) > 100 || _dbCheck > 10) {
            console.clear();
            throw new Error('Debugging not allowed');
          }
        }, 3000);
      })();
    `;
  }

  createTamperProtection() {
    let hash = 0;
    for (let i = 0; i < this.code.length; i++) {
      hash = ((hash << 5) - hash) + this.code.charCodeAt(i);
      hash |= 0;
    }
    
    return `
      (function() {
        const _originalHash = ${hash};
        setInterval(function() {
          let _currentHash = 0;
          const _checkStr = ${JSON.stringify(this.code.substring(0, 100))};
          for(let i = 0; i < _checkStr.length; i++) {
            _currentHash = ((_currentHash << 5) - _currentHash) + _checkStr.charCodeAt(i);
            _currentHash |= 0;
          }
          if(_currentHash !== _originalHash) {
            throw new Error('Code integrity check failed');
          }
        }, 5000);
      })();
    `;
  }

  createTimebomb(expiryTimestamp) {
    return `
      (function() {
        const _expiry = ${expiryTimestamp};
        const _now = Date.now();
        
        if(_now > _expiry) {
          const _err = new Error();
          _err.name = 'LicenseExpiredError';
          _err.message = '🔐 License has expired. Contact @Xatanicvxii on Telegram to renew.';
          _err.code = 'LICENSE_EXPIRED';    
          console.error('   ENCRYPT GLOBAL - EXPIRED');
          
          console.error('License expired on: ' + new Date(_expiry).toISOString().slice(0,10) + '');
          console.error('║  Contact: @Xatanicvxii on Telegram ║');
          throw _err;
        }
        
        const _remaining = Math.floor((_expiry - _now) / (1000 * 60 * 60 * 24));
        if(_remaining <= 3 && _remaining > 0) {
          console.warn('\\n⚠️ Warning: License expires in ' + _remaining + ' days\\n');
        }
      })();
    `;
  }

  async obfuscate() {
    let result = this.code;
    
    // Variable renaming
    result = this.renameVars(result);
    
    // String encoding
    result = this.encodeStrings(result);
    
    // Dispatcher
    result = this.createDispatcher() + '\n' + result;
    
    // Control flow flattening
    if (result.length > 200) {
      result = this.flattenControlFlow(result);
    }
    
    // Self defending
    result = this.createSelfDefending() + '\n' + result;
    
    // Anti debug
    result = this.createAntiDebug() + '\n' + result;
    
    // Tamper protection
    result = this.createTamperProtection() + '\n' + result;
    
    // Timebomb
    const expiryTime = Date.now() + (this.expiryDays * 24 * 60 * 60 * 1000);
    result = this.createTimebomb(expiryTime) + '\n' + result;
    
    // Final wrapper
    result = `
      (function() {
        'use strict';
        ${result}
      })();
    `;
    
    return {
      obfuscated: result,
      expiry: expiryTime,
      expiryDate: new Date(expiryTime).toISOString(),
      stats: {
        originalSize: this.code.length,
        obfuscatedSize: result.length,
        ratio: ((result.length / this.code.length) * 100).toFixed(2) + '%'
      }
    };
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { code, expiryDays = 7 } = req.body;
    
    if (!code || code.trim().length === 0) {
      return res.status(400).json({ error: 'No code provided' });
    }
    
    const days = Math.min(Math.max(parseInt(expiryDays) || 7, 1), 365);
    
    const obfuscator = new HardObfuscator(code, days);
    const result = await obfuscator.obfuscate();
    
    res.json({
      success: true,
      ...result,
      contact: 'https://t.me/Xatanicvxii'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      contact: 'https://t.me/Xatanicvxii'
    });
  }
};