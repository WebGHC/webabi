if(typeof exports === 'undefined'){
  var dec = new TextDecoder();
  var enc = new TextEncoder();
  var stdout__buf = "";
  var utils = {
    bufToStr : function(buf, ptr, end) {
      return dec.decode(buf.slice(ptr, end));
    },
    strToBuf: function (str, buf, off) {
      var b = enc.encode(str);
      buf.set(b, off);
      return b.length;
    },
    strToBufWithZero: function (str, buf, off) {
      var len = utils.strToBuf(str, buf, off);
      buf[len] = 0;
      return len + 1;
    },
    stdout__write: function (str) {
      var i = str.lastIndexOf("\n");
      if (i >= 0) {
        console.log(stdout__buf + str.substring(0, i));
        stdout__buf = str.substring(i + 1);
      } else {
        stdout__buf += str;
      }
    },
  };
} else {
  exports.bufToStr = function (buf, ptr, end) {
    var b = Buffer.from(buf);
    return b.toString('utf8', ptr, end);
    // dec.decode(buf.slice(ptr, end));
  }

  var strToBuf = function (str, buf, off) {
    var b = Buffer.from(str);
    buf.set(b, off);
    return b.length;
  }

  exports.strToBufWithZero = function (str, buf, off) {
    var len = strToBuf(str, buf, off);
    buf[len] = 0;
    return len + 1;
  }

  var stdout__buf = "";
  exports.stdout__write = function (str) {
    var i = str.lastIndexOf("\n");
    if (i >= 0) {
      console.log(stdout__buf + str.substring(0, i));
      stdout__buf = str.substring(i + 1);
    } else {
      stdout__buf += str;
    }
  }
}

