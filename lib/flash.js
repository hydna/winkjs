function FlashSocketInterface() {
  var exports = { onhandshake: 1, onready: 1, onopen: 1,
                  onclose: 1, onerror: 1, onmessage: 1 };

  function FlashSocket(url) {
    this.id = FlashSocket.incr++;
    this.url = url;
    this.connected = false;
    FlashSocket.all[this.id] = this;
    if (!FlashSocket.bridge) return FlashSocket.embed();
    url = url.protocol + "://" + url.addr;
    if (FlashSocket.flashready) FlashSocket.bridge.init(this.id, url);
  }

  Channel.__bridge = FlashSocket;

  FlashSocket.all = {};
  FlashSocket.incr = 1;
  FlashSocket.flashready = false;
  FlashSocket.bridge = null;

  FlashSocket.embed = function() {
    var body = document.getElementsByTagName('body')[0];
    var str = [];
    var vars = [];
    var flashid;
    var codebase;
    var pluginpage;
    var path;
    var bridge;
    var tmpl;
    var id;

    // Both `name` and `id` is required by internet explorer. We 
    // use current tick to generate an unqiue ID.
    id = "__" + (new Date()).getTime();

    for (var key in exports) {
      vars.push(key + "=" + TARGET_NAME + ".__bridge." + key);
    }

    codebase = "http://fpdownload.macromedia.com/pub/shockwave/cabs/"
               "flash/swflash.cab#version=9,0,0,0";

    pluginpage = "http://www.macromedia.com/go/getflashplayer";

    path = "bridge10.swf?" + (Math.random() * 0xFFFFFFFF);

    str[0 ] = '<object name="' + id + '" id="' + id + '"' +
              ' classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000"' +
              ' codebase="' +  codebase + '" name=' +
              ' width="1" height="1">';
    str[1 ] = '<param name="allowScriptAccess" value="always"></param>';
    str[2 ] = '<param name="allowNetworking" value="true"></param>';
    str[3 ] = '<param name="movie" value="' + path + '"></param>';
    str[4 ] = '<param name="quality" value="low"></param>';
    str[5 ] = '<param name="menu" value="false"></param>';
    str[6 ] = '<param name="FlashVars" value="' + vars.join("&") + '">';
    str[7 ] = '</param><param name="bgcolor" value="#ffffff"></param>';
    str[8 ] = '<param name="wmode" value="transparent"></param>';
    str[9 ] = '<embed src="' + path + '" quality="low" bgcolor="#ffffff"' +
              ' wmode="transparent" width="1" height="1"' +
              ' swLiveConnect="true" allowScriptAccess="always"' +
              ' allowNetworking="true" menu="false"' +
              ' type="application/x-shockwave-flash"' +
              ' FlashVars="' + vars.join("&") + '"' +
              ' pluginspage="' + pluginpage + '"/>';
    str[10] = '</object>';


    tmpl = document.createElement("div");
    tmpl.innerHTML = str.join("");
    bridge = tmpl.childNodes[0];

    for (var i = 0; i < bridge.childNodes.length; i++) {
      if (bridge.childNodes[i].nodeName.toUpperCase() == "EMBED") {
        bridge = bridge.childNodes[i];
        break;
      }
    }

    bridge.style.position = "absolute";
    bridge.style.top = "0px";
    bridge.style.left = "0px";
    bridge.style.width = "1px";
    bridge.style.height = "1px";
    bridge.style.zIndex = "-100000";

    body.appendChild(bridge);

    FlashSocket.bridge = bridge;
  };


  FlashSocket.onhandshake = function() {
    return typeof navigator !== "undefined" && navigator.userAgent || "none";
  };


  FlashSocket.onready = function() {
    nextTick(function() {
      var all = FlashSocket.all;
      var url;

      FlashSocket.flashready = true;

      for (var id in all) {
        url = all[id].url.protocol + "://" + all[id].url.addr;
        FlashSocket.bridge.init(all[id].id, url);
      }

    });
    return true;
  };


  FlashSocket.onopen = function(id) {
    var sock;
    if ((sock = FlashSocket.all[id]) && sock.onopen) {
      sock.connected = true;
      sock.onopen();
    }
  };


  FlashSocket.onerror = function(id, err) {
    var sock;
    if ((sock = FlashSocket.all[id])) {
      sock.destroy(new Error(err || "unknown bridge socket error"));
    }
  };


  FlashSocket.onclose = function(id) {
    var sock;
    if ((sock = FlashSocket.all[id]) && sock.onclose) {
      sock.destroy();
    }
  };


  FlashSocket.onmessage = function(id, data) {
    var sock;
    if ((sock = FlashSocket.all[id])) {
      sock.onmessage({ data: data });
    }
  };


  FlashSocket.prototype.onmessage = sockMessageUtfImpl;


  FlashSocket.prototype.send = function(data) {
    FlashSocket.bridge.send(this.id, data);
  };


  FlashSocket.prototype.close = function() {
    this.destroy();
  };


  FlashSocket.prototype.destroy = function(err) {

    if (!this.id) return;

    if (this.connected) {
      FlashSocket.bridge.close(this.id);
    }

    delete FlashSocket.all[this.id];

    this.id = null;

    if (err) {
      this.onerror && this.onerror(err);
    }

    this.onclose && this.onclose();
  };


  return function (url, C) {
    var sock = new FlashSocket(url);

    sock.onopen = function() {
      sock.onopen = sock.onclose = sock.onerror = null;
      return C(null, sock);
    };

    sock.onclose = function() {
      sock.onopen = sock.onclose = sock.onerror = null;
      return C(new Error("Faild to connect to remote"));
    };

    sock.onerror = function(err) {
      sock.onopen = sock.onclose = sock.onerror = null;
      return C(err);
    };
  };
}