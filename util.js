var dec = new TextDecoder();
var enc = new TextEncoder();

function bufToStr(buf, ptr, end) {
  return dec.decode(buf.slice(ptr, end));
}

function strToBuf(str, buf, off) {
  var b = enc.encode(str);
  buf.set(b, off);
  return b.length;
}

function strToBufWithZero(str, buf, off) {
  var len = strToBuf(str, buf, off);
  buf[len] = 0;
  return len + 1;
}

var stdout__buf = "";
function stdout__write(str) {
  var i = str.lastIndexOf("\n");
  if (i >= 0) {
    console.log(stdout__buf + str.substring(0, i));
    stdout__buf = str.substring(i + 1);
  } else {
    stdout__buf += str;
  }
}
