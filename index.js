const fs = require('fs');
const os = require('os');
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');
const Struct = require('ref-struct');
const ArrayType = require('ref-array');
const iconv = require('iconv-lite');
const hardware = {};
const find = '\u0000';
const re = new RegExp(find, 'g');
const stack = require('callsite');

function hazardous(location) {
  const electronRegex = /[\\/]electron\.asar[\\/]/;
  const asarRegex = /^(?:^\\\\\?\\)?(.*\.asar)[\\/](.*)/;
  /* convert path when use electron asar unpack
   */
  if (!path.isAbsolute(location)) {
    return location;
  }

  if (electronRegex.test(location)) {
    return location;
  }

  const matches = asarRegex.exec(location);
  if (!matches || matches.length !== 3) {
    return location;
  }

  /* Skip monkey patching when an electron method is in the callstack. */
  const skip = stack().some(site => {
    const siteFile = site.getFileName();
    return /^ELECTRON_ASAR/.test(siteFile) || electronRegex.test(siteFile);
  });

  return skip ? location : location.replace(/\.asar([\\/])/, '.asar.unpacked$1');
}


const PersonInfo = Struct({
  name: ArrayType('char', 32),
  sex: ArrayType('char', 4),
  nation: ArrayType('char', 20),
  birthday: ArrayType('char', 12),
  address: ArrayType('char', 72),
  cardId: ArrayType('char', 20),
  police: ArrayType('char', 32),
  validStart: ArrayType('char', 12),
  validEnd: ArrayType('char', 12),
  // sexCode: ArrayType('char', 4),
  // nationCode: ArrayType('char', 4),
  appendMsg: ArrayType('char', 72),
});

const libhf = ffi.Library(hazardous(path.join(__dirname, './lib/HFSSSE32.dll')), {
  ICC_Reader_Open: [ 'string', [ 'pointer' ]],
  ICC_Reader_Close: [ 'int', [ 'pointer' ]],
  PICC_Reader_ReadIDInfo: ['int',['pointer','string',ref.refType(PersonInfo)]],
});

hardware.ICC_Reader_Open = port => {
  try {
    const handle = libhf.ICC_Reader_Open(port);
    if (ref.isNull(handle)) {
      return { error: -1 };
    }
    return { error: 0, data: { handle } };
  } catch (e) {
    return { error: -1 };
  }
};

hardware.ICC_Reader_Close = handle => {
  try {
    const res = libhf.ICC_Reader_Close(handle);
    if (res === 0) {
      return { error: 0 };
    }
    return { error: -1 };
  } catch (e) {
    return { error: -1 };
  }
};



// 读身份证信息
hardware.PICC_Reader_ReadIDInfo = handle => {
  try {
    const personInfo = new PersonInfo();
    const folder = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
    const image = path.join(folder, 'image.bmp');
    // const res = libcvr.GetPersonMsgA(personInfo.ref(), image);
    const res = libhf.PICC_Reader_ReadIDInfo(handle,image,personInfo.ref());
    if (res === 0) {
      return { error: 0, data: {
        name: iconv.decode(Buffer.from(personInfo.name), 'gbk').replace(re, '').trim(),
        sex: iconv.decode(Buffer.from(personInfo.sex), 'gbk').replace(re, '').trim(),
        nation: iconv.decode(Buffer.from(personInfo.nation), 'gbk').replace(re, '').trim(),
        birthday: iconv.decode(Buffer.from(personInfo.birthday), 'gbk').replace(re, '').trim(),
        address: iconv.decode(Buffer.from(personInfo.address), 'gbk').replace(re, '').trim(),
        cardId: iconv.decode(Buffer.from(personInfo.cardId), 'gbk').replace(re, '').trim(),
        police: iconv.decode(Buffer.from(personInfo.police), 'gbk').replace(re, '').trim(),
        validStart: iconv.decode(Buffer.from(personInfo.validStart), 'gbk').replace(re, '').trim(),
        validEnd: iconv.decode(Buffer.from(personInfo.validEnd), 'gbk').replace(re, '').trim(),
        // sexCode: iconv.decode(Buffer.from(personInfo.sexCode), 'gbk').replace(re, '').trim(),
        // nationCode: iconv.decode(Buffer.from(personInfo.nationCode), 'gbk').replace(re, '').trim(),
        appendMsg: iconv.decode(Buffer.from(personInfo.appendMsg), 'gbk').replace(re, '').trim(),
        image,
      } };
    }
    return { error: -1 };
  } catch (e) {
    return { error: -1 };
  }
};

module.exports = hardware;
