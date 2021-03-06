function randomBase64String() {
    var base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var stringLength = 8;
    var randomString = '';
    for (var i = 0; i < stringLength; i++) {
        randomString += base64Alphabet.charAt(Math.floor(Math.random() * base64Alphabet.length));
    }
    return randomString;
}

function saltAndHash(password) {
    var salt = randomBase64String();
    var digest = CryptoJS.enc.Base64.stringify(CryptoJS.SHA1(salt + "_" + password));
    return salt + "_" + digest;
}

function defaultFunction(arg, defaultFunction) {
    return typeof arg === 'function' ? arg : (typeof defaultFunction === 'function' ? defaultFunction : (function () {
    }));
}

function platformSpecific(parameters) {
    if (!parameters) {
        return;
    }
    var ret;
    var ua = navigator.userAgent;
    var platform = {
        ios:ua.match(/(iPhone|iPod|iPad)/),
        android:ua.match(/Android/)
    };
    if (platform.android && parameters.hasOwnProperty("android")) {
        ret = parameters.android();
    } else if (platform.ios && parameters.hasOwnProperty("ios")) {
        ret = parameters.ios();
    } else if (parameters.hasOwnProperty("standard")) {
        ret = parameters.standard();
    }
    if (ret) {
        return ret;
    }
}

function hasConnection() {
    if (!navigator.network) {
        return true; // No checking
    }
    return navigator.network.connection.type === Connection.ETHERNET ||
        navigator.network.connection.type === Connection.WIFI ||
        navigator.network.connection.type === Connection.CELL_2G ||
        navigator.network.connection.type === Connection.CELL_3G ||
        navigator.network.connection.type === Connection.CELL_4G;
}

jQuery.fn.outerHTML = function () {
    return $('<div>').append(this.eq(0).clone()).html();
};