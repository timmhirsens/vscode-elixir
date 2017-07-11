// The code
// API
export function encode(obj, mtu = 500000) {
    let dv = new DataView(new ArrayBuffer(mtu));
    dv.setUint8(0, 131);
    const [v, i] = _encodeValue(obj, dv, 1);
    dv = v as DataView;
    return dv.buffer.slice(0, i);
}

export function decode(buffer) {
    const dv = new DataView(buffer);
    if (dv.getUint8(0) !== 131) {
        // tslint:disable-next-line:no-string-throw
        throw 'badarg';
    }
    else {
        return _decodeValue(dv, 1)[0];
    }
}

// Internal functions
function _encodeValue(value, dv, i) {
    if (value === null) {
        return _encodeNull(dv, i);
    }
    else {
        switch (value.constructor.name) {
            case 'Object': return _encodeObject(value, dv, i);
            case 'Number': return _encodeNumber(value, dv, i);
            case 'Array': return _encodeArray(value, dv, i);
            case 'String': return _encodeString(value, dv, i);
            case 'Boolean': return _encodeBoolean(value, dv, i);
        }
    }
}

function _decodeValue(dv, i) {
    switch (dv.getUint8(i)) {
        case 70:
            return [dv.getFloat64(i + 1), i + 9];
        case 97:
            return [dv.getUint8(i + 1), i + 2];
        case 98:
            return [dv.getInt32(i + 1), i + 5];
        case 100:
        case 118:
        case 119:
            return _decodeAtom(dv, i + 1);
        case 104:
            return _decodeTuple(dv, i + 1);
        case 106:
            return [[], i + 1];
        case 108:
            return _decodeArray(dv, i + 1);
        case 109:
            return _decodeString(dv, i + 1);
        case 116:
            return _decodeObject(dv, i + 1);
        default:
            // tslint:disable-next-line:no-string-throw
            throw 'bad_tag: ' + dv.getUint8(i);
    }
}

function _encodeNull(dv, i) {
    dv = _getDataView(dv, i, 6);
    dv.setUint8(i, 100);
    dv.setUint16(i + 1, 3);
    dv.setUint8(i + 3, 110);
    dv.setUint8(i + 4, 105);
    dv.setUint8(i + 5, 108);
    return [dv, i + 6];
}

function _decodeAtom(dv, i) {
    let str = '';
    const atomType = dv.getUint8(i - 1);
    let k = 0;
    switch (atomType) {
        case 118:
        case 100:
            let l = dv.getUint16(i);
            i += 2;
            for (k = 0; k < l; k++) {
                str += String.fromCharCode(dv.getUint8(i + k));
            }
            break;
        case 119:
            let l = dv.getUint8(i);
            i += 1;
            for (k = 0; k < l; k++) {
                str += String.fromCharCode(dv.getUint8(i + k));
            }
            break;
    }

    let value;
    switch (str) {
        // tslint:disable-next-line:no-null-keyword
        case 'nil': value = null; break;
        case 'true': value = true; break;
        case 'false': value = false; break;
        default: value = str;
    }
    return [value, i + k];
}

function _encodeObject(obj, dv, i) {
    dv = _getDataView(dv, i, 5);
    dv.setUint8(i, 116);
    i += 1;
    const keys = Object.keys(obj);
    const l = keys.length;
    dv.setUint32(i, l);
    i += 4;
    for (let k = 0; k < l; k++) {
        const key = keys[k];
        let [dv, i] = _encodeString(key, dv, i);
        const [dv, i] = _encodeValue(obj[key], dv, i);
    }
    return [dv, i];
}

function _decodeObject(dv, i) {
    const l = dv.getUint32(i);
    i += 4;
    const obj = {};
    for (let k = 0; k < l; k++) {
        // var [key, i] = _decodeString(dv, i + 1);
        const [key, i] = _decodeAtom(dv, i + 1);
        const [value, i] = _decodeValue(dv, i);
        obj[key] = value;
    }
    return [obj, i];
}

function _encodeNumber(num, dv, i) {
    // Check if we have a float or not
    if (num !== Math.floor(num)) {
        dv = _getDataView(dv, i, 9);
        dv.setUint8(i, 70);
        dv.setFloat64(i + 1, num);
        return [dv, i + 9];
    }
    else {
        if (num >= 0 && num < 255) {
            dv = _getDataView(dv, i, 2);
            dv.setUint8(i, 97);
            dv.setUint8(i + 1, num);
            return [dv, i + 2];
        }
        else {
            dv = _getDataView(dv, i, 5);
            dv.setUint8(i, 98);
            dv.setInt32(i + 1, num);
            return [dv, i + 5];
        }
    }
}

function _encodeArray(arr, dv, i) {
    dv = _getDataView(dv, i, 5);
    dv.setUint8(i, 108);
    i += 1;
    const l = arr.length;
    dv.setUint32(i, l);
    i += 4;
    for (let k = 0; k < l; k++) {
        const [dv, i] = _encodeValue(arr[k], dv, i);
    }
    dv = _getDataView(dv, i, 1);
    dv.setUint8(i, 106);
    return [dv, i + 1];
}

function _decodeTuple(dv, i) {
    const l = dv.getUint8(i);
    i += 1;
    const arr = [];
    for (let k = 0; k < l; k++) {
        const [value, i] = _decodeValue(dv, i);
        arr[k] = value;
    }
    return [arr, i + 1];
}

function _decodeArray(dv, i) {
    const l = dv.getUint32(i);
    i += 4;
    const arr = [];
    for (let k = 0; k < l; k++) {
        const [value, i] = _decodeValue(dv, i);
        arr[k] = value;
    }
    return [arr, i + 1];
}

function _encodeString(str, dv, i) {
    const arr = stringToUint(str);
    const l = arr.length;
    dv = _getDataView(dv, i, l + 5);
    dv.setUint8(i, 109);
    i += 1;
    dv.setUint32(i, l);
    i += 4;
    for (let k = 0; k < l; k++) {
        dv.setUint8(i + k, arr[k]);
    }
    return [dv, i + k];
}

function _decodeString(dv, i) {
    const l = dv.getUint32(i);
    i += 4;
    const arr = [];
    for (let k = 0; k < l; k++) {
        arr.push(dv.getUint8(i + k));
    }
    return [uintToString(arr), i + k];
}

function stringToUint(str) {
    const strVal = unescape(encodeURIComponent(str));
    const charList = strVal.split('');
    const uintArray = [];
    for (let i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

function uintToString(uintArray) {
    const encodedString = String.fromCharCode.apply(null, uintArray);
    const decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}

function _encodeBoolean(bool, dv, i) {
    dv = _getDataView(dv, i, 8);
    dv.setUint8(i, 100);
    if (bool) {
        dv.setUint16(i + 1, 4);
        dv.setUint32(i + 3, 1953658213);
        return [dv, i + 7];
    }
    else {
        dv.setUint16(i + 1, 5);
        dv.setUint8(i + 3, 102);
        dv.setUint32(i + 4, 1634497381);
        return [dv, i + 8];
    }
}

// Utils
function _getDataView(dv, i, l) {
    if (dv.byteLength < i + l) {
        return new DataView(_expandBuffer(dv.buffer, i + l));
    }
    else {
        return dv;
    }
}

function _expandBuffer(buffer, minLength) {
    const tempArr = new Uint8Array(Math.max(minLength, buffer.length * 2));
    tempArr.set(buffer, 0);
    return tempArr.buffer;
}

declare function unescape(s: string): string;
declare function escape(s: string): string;
