const fs = require('fs');
const os = require('os');
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const path = require('path');
const Struct = require('ref-struct-napi');
const ArrayType = require('ref-array-napi');
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
  ICC_Reader_Open: [ 'pointer', [ 'string' ]],
  ICC_Reader_Close: [ 'int', [ 'pointer' ]],
  ICC_Reader_GetDeviceVersion: ['int', [ 'pointer','pointer' ]],
  ICC_Reader_PrintFlage: ['int', [ 'pointer','pointer' ]],
  ReadDevice: ['int', [ 'pointer','pointer' ]],
  PICC_Reader_ReadIDInfo: ['string',['pointer','string','pointer','pointer','pointer','pointer','pointer','pointer','pointer','pointer','pointer','pointer']],
});

hardware.ICC_Reader_Open = port => {
  try {
    const handle = libhf.ICC_Reader_Open(port);
    if (ref.isNull(handle)) {
      return { error: -1 };
    }
    return { error: 0, data: { handle } };
  } catch (e) {
  	console.log(e)
    return { error: -1 };
  }
};
hardware.ICC_Reader_PrintFlage = handle => {
  try {
  	// const v = ref.
  	 const atPosition = ref.alloc(ref.types.uchar);
  	 // const data = Buffer.alloc(500 * ref.types.uchar.size);
    // data.type = ref.types.uchar;
    const res = libhf.ICC_Reader_PrintFlage(handle,atPosition);
    console.log(res,atPosition.deref(),'xxxx')
    if (res === 1) {
      return { error: 0,data:{status:atPosition.deref()} };
    }
    return { error: -1 };
  } catch (e) {
  	console.log(e)
    return { error: -1 };
  }
};
hardware.ReadDevice = handle => {
  try {
  	// const v = ref.
  	 const atPosition = ref.alloc(ref.types.char);
  	 // const data = Buffer.alloc(500 * ref.types.uchar.size);
    // data.type = ref.types.uchar;
    const res = libhf.ReadDevice(handle,atPosition);
    console.log(res,atPosition.deref(),'xxxx')
    if (res === 0) {
      return { error: 0 };
    }
    return { error: -1 };
  } catch (e) {
  	console.log(e)
    return { error: -1 };
  }
};
hardware.ICC_Reader_GetDeviceVersion = handle => {
  try {
  	// const v = ref.
  	 const atPosition = ref.alloc(ref.types.byte);
  	 // const data = Buffer.alloc(500 * ref.types.uchar.size);
    // data.type = ref.types.uchar;
    const res = libhf.ICC_Reader_GetDeviceVersion(handle,atPosition);
    console.log(res,atPosition.deref(),'xxxx')
    if (res === 0) {
      return { error: 0 };
    }
    return { error: -1 };
  } catch (e) {
  	console.log(e)
    return { error: -1 };
  }
};

hardware.ICC_Reader_Close = handle => {
  try {
    const res = libhf.ICC_Reader_Close(handle);
    console.log(res)
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
  	//console.log('x')
    const personInfo = new PersonInfo();
    const folder = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
    const image = path.join(folder, 'image.bmp');
    // const res = libcvr.GetPersonMsgA(personInfo.ref(), image);
    // console.log(handle,image)
    const pName = ref.alloc(ArrayType('char', 32));
    const pSex = ref.alloc(ref.types.char);
    const pNation = ref.alloc(ref.types.char);
    const pBirth = ref.alloc(ref.types.char);
    const pAddress = ref.alloc(ref.types.char);
    const pCertNo =ref.alloc(ArrayType('char', 32));
    const pDepartment = ref.alloc(ref.types.char);
    const pEffectData = ref.alloc(ref.types.char);
    const pExpire = ref.alloc(ref.types.char);
    const pErrMsg = ref.alloc(ref.types.char);
    const res = libhf.PICC_Reader_ReadIDInfo(
    	handle,
    	image,
    	pName,pSex,pNation,pBirth,pAddress,pCertNo,pDepartment,pEffectData,pExpire,pErrMsg);
    console.log(res,iconv.decode(Buffer.from(pName), 'gbk'))
    if (res === 0) {
      return { error: 0, data: {
        name: iconv.decode(Buffer.from(pName), 'gbk'),
        sex: iconv.decode(Buffer.from(pSex), 'gbk'),
        // nation: iconv.decode(Buffer.from(pSex), 'gbk'),
        birthday: iconv.decode(Buffer.from(pBirth), 'gbk'),
        address: iconv.decode(Buffer.from(pAddress), 'gbk'),
        cardId: iconv.decode(Buffer.from(pCertNo), 'gbk'),
        // police: iconv.decode(Buffer.from(personInfo.police), 'gbk').replace(re, '').trim(),
        // validStart: iconv.decode(Buffer.from(personInfo.validStart), 'gbk').replace(re, '').trim(),
        // validEnd: iconv.decode(Buffer.from(personInfo.validEnd), 'gbk').replace(re, '').trim(),
        // // sexCode: iconv.decode(Buffer.from(personInfo.sexCode), 'gbk').replace(re, '').trim(),
        // // nationCode: iconv.decode(Buffer.from(personInfo.nationCode), 'gbk').replace(re, '').trim(),
        // appendMsg: iconv.decode(Buffer.from(personInfo.appendMsg), 'gbk').replace(re, '').trim(),
        // image,
      } };
    }
    return { error: -1 };
  } catch (e) {
  	console.log(e)
    return { error: -1 };
  }
};

module.exports = hardware;
