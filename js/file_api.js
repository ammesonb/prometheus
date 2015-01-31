window = this;
isWorker = (typeof importScripts === 'function');
notWorker = !isWorker;
workers = !!window.Worker;
// Google Chrome
M_GC = 0;
// Firefox
M_IDB = 1;
S_200K = 204800;
S_1M = 1048576;
S_100M = 104857600;

f_avail = {};
mode = M_GC;
/*{{{*/ /* TODO
    Pause button - functioning in workers?
    Add decrypt time using setTimeout
    Call clean when 'X' is clicked - entry already removed in 'finish' but blob still present
    Allow three parallel downloads
    IndexedDB downloads WILL NOT WORK - writes to a field but getFile returns the whole object
    IndexedDB won't work in workers for Firefox - need to check access to window.indexedDB to determine that
*/ /*}}}*/

// If not worker, use asynchronous methods/*{{{*/
if (notWorker) {
    // Check if File System API supported
    requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    storageInfo = navigator.webkitPersistentStorage || window.webkitStorageInfo;
    resolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL;

    // If not, drop to Indexed DB/*{{{*/
    if (!requestFileSystem) {
        mode = M_IDB;
        window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
            IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction,
            dbVersion = 5;
        dbName = 'media';
        request = indexedDB.open(dbName, 5);
        request.onsuccess = function(e) {db = e.target.result;};
        request.onupgradeneeded = function(e) {
            db = e.target.result;
            obj = db.createObjectStore(dbName, {keyPath: "sessionID"});
            obj.createIndex("data", "data", {unique: false});
        };
    }/*}}}*//*}}}*/
} else {/*{{{*/
    importScripts('components/core.js');
    importScripts('components/enc-base64.js');
    importScripts('components/pbkdf2.js');
    importScripts('components/hmac.js');
    importScripts('components/md5.js');
    importScripts('components/sha1.js');
    importScripts('components/evpkdf.js');
    importScripts('components/cipher-core.js');
    importScripts('components/aes.js');
    importScripts('site.js');
    self.requestFileSystem = self.webkitRequestFileSystemSync || self.requestFileSystemSync;
}/*}}}*/

function FileAPI() {/*{{{*/
  return {
    // Attributes/*{{{*/
    events: {},
    status: 'Queued',
    sessionID: undefined,
    progress: 0,
    completed: false,
    paused: false,
    failed: 0,

    fs: undefined,
    kind: '',
    file: '',
    dataURI: undefined,
    encKey: undefined,

    size: undefined,
    res: 200,
    received: 0,
    chunkLength: 0,
    chunks: 0,
    chunksDecrypted: 0,
    avgSpeed: 0,
    startedAt: undefined,
    chunkSpeed: 0,
    startedChunkAt: 0,
    startedChunkTransferAt: 0,
    endedChunkTransferAt: 0,
    endedChunkAt: 0,
    currentXHRReq: undefined,/*}}}*/

    // Event listeners/*{{{*/
    addEventListener: function(type, f) {/*{{{*/
        if (!this.events[type]) this.events[type] = [];
        this.events[type].push({
            action: f,
            type: type, 
            target: this
        }); 
    },/*}}}*/
    
    removeEventListener: function(type, f) {/*{{{*/
        if (this.events[type]) {
            for (e = 0; e < this.events[type].length; e++) {
                if (this.events[type][e].action === f) {this.events[type].splice(e, 1);}
            }
        }
    },/*}}}*/
    
    dispatchEvent: function(type) {/*{{{*/
        if (!this.events[type]) {return;}
        for (e = 0; e < this.events[type].length; e++) {
            this.events[type][e].action(this.events[type][e]);
        }
    },/*}}}*//*}}}*/
    
    // Internal status functions/*{{{*/
    updateStatus: function(status) {/*{{{*/
        this.status = status;
        this.dispatchEvent('onstatusupdate');
    },/*}}}*/

    updateProgress: function(bytesTransferred, transferTime, totalTime) {/*{{{*/
        if (this.status != 'Decrypting') {
            // Change time into seconds
            totalTime /= 1000;
            transferTime /= 1000;
            this.received += parseInt(bytesTransferred, 10);
            this.progress = this.received / this.size;
            this.chunkSpeed = bytesTransferred / totalTime;
            this.avgSpeed = this.received / ((new Date().getTime() - this.startedAt) / 1000);
        } else {
            this.progress = this.chunksDecrypted / this.chunks;
            this.chunkSpeed = '--';
            this.avgSpeed = '--';
        }

        if (this.failed) {this.progress = '--';}
        else {this.progress = this.progress.toFixed(4);}

        this.dispatchEvent('onprogressupdate');
    },/*}}}*/

    fail: function(text) {/*{{{*/
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.send('s=2&si=' + this.sessionID);

        if (text) {
            this.updateStatus(text);
        } else {
            this.updateStatus('Failed');
        }
        this.failed = 1;
        this.received = 0;
        this.chunkSpeed = '--';
        this.avgSpeed = '--';
        this.dispatchEvent('onprogressupdate');
        this.dispatchEvent('onfail');
    },/*}}}*//*}}}*/

    // Functions
    initialize: function(file, kind) {/*{{{*/
        this.updateStatus('Preparing download');
        this.file = file;
        this.kind = kind;
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.fAPI = this;
        this.currentXHRReq.onreadystatechange = function() {/*{{{*/
            if (this.readyState === 4 && this.status == 200 && this.responseText.indexOf('nofile') == -1) {this.fAPI.start();}
            else if (this.responseText.indexOf('nofile') != -1) {this.fAPI.fail('File does not exist');}
            else if (this.readyState === 4) {this.fAPI.fail('Internal error - contact me');}
        };/*}}}*/
        this.currentXHRReq.send('s=0&f=' + file + '&k=' + kind);
    },/*}}}*/

    start: function() {/*{{{*/
        this.updateStatus('Loading session data');
        data = this.currentXHRReq.responseText.split(';;;');
        data[0] = data[0].replace(/\u000a/g, '');
        this.encKey = hex2a(CryptoJS.AES.decrypt(data[0], master_key).toString());
        fr = new FileReader();
        fr.fAPI = this;
        fr.onload = function() {this.fAPI.encKey = this.result;}
        fr.readAsText(new Blob([this.encKey]));
        this.sessionID = data[1];
        this.size = parseInt(data[2], 10);
        this.initializeStorage();
    },/*}}}*/

    initializeStorage: function() {/*{{{*/
        this.updateStatus('Creating local data store');
        size = this.size + (1024*1024*1024*1024) * Math.ceil(this.size / (1024 * 1024 * 1024 *1024));

        if (mode === M_IDB) {/*{{{*/
            trans = db.transaction([dbName], "readwrite");
            trans.fAPI = this;
            trans.oncomplete = function(e) {this.fAPI.startedAt = new Date().getTime(); this.fAPI.next(2);}
            trans.onerror = function(e) {this.fAPI.failed = 1; this.fAPI.updateStatus('Failed');}
            obj = trans.objectStore(dbName);
            obj.put({sessionID: this.sessionID, avail: 0, data: ''});/*}}}*/
        } else {/*{{{*/
            if (navigator.webkitPersistentStorage) {
                fAPI = this;
                storageInfo.requestQuota(size, function(bytes) {fAPI.createBlob(fAPI, bytes)}, function(e) {fAPI.fail(fAPI, e);});
            } else {
                storageInfo.requestQuota(PERSISTENT, size, function(bytes) {fAPI.createBlob(fAPI, bytes)}, function(e) {fAPI.fail(fAPI, e);});
            }
        }/*}}}*/
    },/*}}}*/
    
    createBlob: function(fAPI, grantedBytes) {/*{{{*/
        requestFileSystem(TEMPORARY, grantedBytes, function(fs) {fAPI.initData(fAPI, fs);}, function(e) {fAPI.fail(fAPI, e);});
    },/*}}}*/
   
    initData: function(fAPI, fs) {/*{{{*/
        fAPI.fs = fs;
        fAPI.fs.fAPI = this;
        fAPI.fs.root.getFile(fAPI.sessionID, {create: true}, function(fileEntry) {/*{{{*/
            fileEntry.fAPI = fAPI;
            fileEntry.createWriter(function(writer) {
                writer.fAPI = fAPI;
                writer.onwritestart = function() {fAPI.updateStatus("Creating data object");};
                writer.onwriteend = function() {fAPI.updateStatus("Created"); fAPI.next();};
                writer.onerror = function(e) {fAPI.fail(e);};
                blob = new Blob([''], {type: 'text/plain'});
                writer.write(blob);
            }, function(e) {console.log(e); fAPI.fail(e);});
        }, function(e) {console.log(e); fAPI.fail(e);});/*}}}*/
    },/*}}}*/

    getFile: function(name, callback, args) {/*{{{*/
        args.push(name);
        fAPI = this;
        if (mode === M_IDB) {/*{{{*/
            trans = db.transaction([dbName]);
            trans.fAPI = this;
            obj = trans.objectStore(dbName);
            req = obj.get(name);
            req.onsuccess = function(e) {
                args.push(this.result);
                callback.apply(fAPI, args);
            };
            req.onerror = function(e) {
                callback(NaN);
            }/*}}}*/
        } else {/*{{{*/
            fAPI = this;
            this.fs.root.getFile(name, {}, function(fE) {
                fE.fAPI = fAPI;
                fE.file(function(file) {
                    reader = new FileReader();
                    reader.onloadend = function(e) {
                        args.push(this.result);
                        callback.apply(fAPI, args);
                    };
                    reader.readAsText(file);
                }, function(e) {
                    args.push(NaN);
                    callback.apply(fAPI, args);
                });
            }, function(e) {
                args.push(NaN);
                callback.apply(fAPI, args);
            });
        }/*}}}*/
    },/*}}}*/

    updateFile: function(name, field, value, type, overwrite, callback, args) {/*{{{*/
        args.push(name);
        fAPI = this;
        if (mode === M_IDB) {/*{{{*/
            trans = db.transaction([dbName], "readwrite");
            obj = trans.objectStore(dbName);
            req = obj.get(name);
            req.onerror = function(e) {args.push(NaN); callback.apply(fAPI, args);}
            req.onsuccess = function(e) {
                data = this.result;
                if (overwrite) {
                    data[field] = value;
                } else {
                    data[field] += value;
                }

                reqUpdate = obj.put(data);
                reqUpdate.onerror = function(e) {args.push(NaN); callback.apply(fAPI, args);}
                reqUpdate.onsuccess = function(e) {args.push(1); callback.apply(fAPI, args);}
            };/*}}}*/
        } else {/*{{{*/
            this.fs.root.getFile(name, {create: overwrite}, function(fE) {
                fE.createWriter(function(writer) {
                    writer.onerror = function(e) {
                        args.push(NaN);
                        callback.apply(fAPI, args);
                    };
                    writer.onwriteend = function(e) {
                        args.push(value);
                        callback.apply(fAPI, args);
                    };

                    if (!overwrite) {
                        writer.seek(writer.length);
                    }

                    blob = new Blob([value], {type: type});
                    writer.write(blob);
                }, function(e) {args.push(NaN); callback.apply(fAPI, args);});
            }, function(e) {args.push(NaN); callback.apply(fAPI, args);});
        }/*}}}*/
    },/*}}}*/

    removeFile: function(name, callback, args) {/*{{{*/
        fAPI = this;
        args.push(name);
        if (mode === M_IDB) {
        } else {
            this.fs.root.getFile(name, {create: false}, function(fE) {
                fE.remove(function() {
                    args.push(1);
                    callback.apply(fAPI, args);
                }, function(e) {console.log(e); args.push(0); callback.apply(fAPI, args);});
            }, function(e) {
                if (e.name !== 'NotFoundError') {
                    console.log(e);
                    args.push(0);
                    callback.apply(fAPI, args);
                } else {
                    args.push(1);
                    callback.apply(fAPI, args);
                }
            });
        }
    },/*}}}*/

    next: function() {/*{{{*/
        fAPI.startedAt = new Date().getTime();
        if (this.paused) {this.updateStatus('Paused'); this.chunkSpeed = '--'; this.avgSpeed = '--'; this.dispatchEvent('onprogressupdate'); return;}
        this.updateStatus('Downloading');
        this.startedChunkAt = new Date().getTime();
        if (workers) {this.startWorkers();}
        else {} // TODO download in main thread
    },/*}}}*/

    startWorkers: function() {/*{{{*/
        ajaxWorker = new Worker('js/file_api.js');
        cryptWorker = new Worker('js/file_api.js');

        ajaxWorker.cryptWorker = cryptWorker;
        ajaxWorker.fAPI = this;
        ajaxWorker.postMessage(['dl', this.sessionID, this.res, this.encKey].join(':'));
        ajaxWorker.addEventListener('message', function(m) {/*{{{*/
            msg = m.data;
            if (msg === 'dl') {
                this.fAPI.startedChunkTransferAt = new Date().getTime();
            } else if (msg.substr(0, 5) === 'dlend') {
                this.fAPI.endedChunkTransferAt = new Date().getTime();
                this.fAPI.chunkLength = parseInt(msg.split('-')[1], 10);
                fAPI.updateProgress(this.fAPI.chunkLength, fAPI.endedChunkTransferAt - fAPI.startedChunkTransferAt, fAPI.endedChunkAt - fAPI.startedChunkAt);
            } else if (msg === 'dlfail') {
                this.cryptWorker.terminate();
                this.fAPI.fail('Download failed');
                this.terminate();
            } else if (msg.substr(0, 5) === 'data-') {
                num = msg.split('-')[1];
                data = msg.split('-')[2];
                this.fAPI.chunks++;
                this.fAPI.updateFile(this.fAPI.sessionID + '-' + num, num, data, 'text/plain', true,
                                     this.fAPI.partVerify, [this.fAPI, this, this.cryptWorker, 0]);
            } else if (msg === 'done') {
                this.fAPI.updateStatus('Decrypting');
                this.terminate();
            }
        });/*}}}*/

        cryptWorker.ajaxWorker = ajaxWorker;
        cryptWorker.fAPI = this;
        cryptWorker.postMessage('decrypt');
        cryptWorker.addEventListener('message', function(m) {/*{{{*/
            msg = m.data;
            if (msg === 'appendFail') {
                this.ajaxWorker.terminate();
                this.fAPI.fail('Failed to store decrypted data');
            } else if (msg === 'nextChunk') {
                if (this.fAPI.chunksDecrypted >= this.fAPI.chunks) {
                    this.postMessage('noneAvail');
                } else {
                    this.fAPI.getFile(this.fAPI.sessionID + '-' + this.fAPI.chunksDecrypted, this.fAPI.sendPart,
                         [this.fAPI.sessionID, this.fAPI.chunksDecrypted, this.fAPI.encKey, cryptWorker]);
                }
            } else if (msg.substr(0, 4) === 'data') {
                num = msg.split('-')[1];
                data = msg.split('-')[2];
                this.fAPI.updateFile(this.fAPI.sessionID, 'data', data, 'text/plain', false, this.fAPI.appendVerify,
                     [this.fAPI, this.ajaxWorker, this, 0]);
            }
        });/*}}}*/
    },/*}}}*/

    sendPart: function(sID, num, key, cryptWorker, name, data) {/*{{{*/
        if (!data || data === NaN) {cryptWorker.postMessage('noneAvail');}
        else {
            cryptWorker.postMessage(['avail', sID, num, key, data].join(':'));
        }
    },/*}}}*/

    dlLoop: function(sID, res, k) {/*{{{*/
        if (paused) {return;}
        transferred = 0;
        while (true) {
            // This will return 0 on failure or completion
            transferred = this.dl(sID, res, transferred);
            if (!transferred) {return 0;}
        }
        return 1;
    },/*}}}*/

    dl: function(sID, res, num) {/*{{{*/
        chunkReq = createPostReq('/file.cgi', false);
        self.postMessage('dl');
        chunkReq.send('s=1&si=' + sID + '&res=' + res);
        self.postMessage('dlend-' + chunkReq.responseText.length);
        if (chunkReq.status != 200) {self.postMessage('dlfail'); return 1;}
        text = chunkReq.responseText.split(':');
        for (i = 0; i < text.length; i++) {
            if (text[i] === '' && i === (text.length - 1)) {break;}
            if (text[i] === "<<#EOF#>>") {return 0;}
            self.postMessage('data-' + num + '-' + text[i]);
            num++;
        }
        return num;
    },/*}}}*/

    partVerify: function(fAPI, ajaxWorker, cryptWorker, repeat, name, part) {/*{{{*/
        if (part === NaN && !repeat) {
            console.log('Append failed - ' + name);
            fAPI.updateFile(name, name.split('-')[1], part, 'text/plain', true, fAPI.partVerify,
                            [fAPI, ajaxWorker, cryptWorker, 1]);
        } else if (part === NaN && repeat) {
            ajaxWorker.terminate();
            cryptWorker.terminate();
            fAPI.fail('Failed to store file part');
        } else {
            fAPI.endedChunkAt = new Date().getTime();
        }
    },/*}}}*/

    appendVerify: function(fAPI, ajaxWorker, cryptWorker, repeat, name, part) {/*{{{*/
        if (part === NaN && !repeat) {
            console.log('Append failed');
            fAPI.updateFile(name, 'data', part, 'text/plain', false, fAPI.appendVerify,
                            [fAPI, ajaxWorker, cryptWorker, 1]);
        } else if (part === NaN && repeat) {
            ajaxWorker.terminate();
            cryptWorker.terminate();
            fAPI.fail('Failed to append file part');
        } else {
            if (fAPI.chunksDecrypted <= fAPI.chunks && fAPI.status != 'Done') {
                fAPI.chunksDecrypted++;
                fAPI.removeFile(fAPI.sessionID + '-' + (fAPI.chunksDecrypted - 1), fAPI.removeVerify, [fAPI, 0]);

                if (fAPI.status === 'Decrypting' && fAPI.chunksDecrypted === fAPI.chunks) {
                    fAPI.updateStatus('Done');
                    fAPI.finish();
                } else if (fAPI.chunksDecrypted >= fAPI.chunks) {
                    this.postMessage('noneAvail');
                } else {
                    fAPI.getFile(fAPI.sessionID + '-' + fAPI.chunksDecrypted, fAPI.sendPart,
                         [fAPI.sessionID, fAPI.chunksDecrypted, fAPI.encKey, cryptWorker]);
                }
            }
            if (fAPI.status === 'Decrypting') {fAPI.updateProgress(0, 0, 0);}
        }
    },/*}}}*/

    removeVerify: function(fAPI, repeat, name, success) {/*{{{*/
        if (!success && !repeat) {fAPI.removeFile(name, fAPI.removeVerify, [fAPI, 1]);}
        else if (!success && repeat) {fAPI.fail('Failed to remove file ' + name);}
    },/*}}}*/

    decryptLoop: function() {/*{{{*/
        self.postMessage('nextChunk');
    },/*}}}*/

    decrypt: function(sID, num, key, etxt) {/*{{{*/
        if (etxt === NaN) {return 1;}
        hex = CryptoJS.AES.decrypt(etxt, key, {mode: CryptoJS.mode.CBC}).toString();
        self.postMessage('data-' + num + '-' + hex);
    },/*}}}*/

    finish: function() {/*{{{*/
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.send('s=2&si=' + this.sessionID);
        this.currentXHRReq = undefined;

        if (mode === M_GC) {/*{{{*/
            fAPI = this;
            this.fs.root.getFile(this.sessionID, {create: false}, function(entry) {
                entry.fAPI = fAPI;
                entry.file(function(file) {
                    fr = new FileReader();
                    fr.fAPI = this.fAPI;
                    fr.onloadend = function(e) {
                        blob = new Blob([hex2a(this.result)]);
                        this.fAPI.dataURI = window.URL.createObjectURL(blob);
                        this.fAPI.updateStatus('Complete');
                        this.fAPI.dispatchEvent('oncomplete');
                        entry.remove(function() {}, function() {});
                    };
                    fr.readAsText(file);
                }, function(e) {
                    this.fAPI.fail('Failed to read file');
                });
            }, function(e) {
                this.fAPI.fail('Failed to create URI');
            });/*}}}*/
        } else if (mode === M_IDB) {/*{{{*/
            this.updateStatus("Creating URI for file");
            r = db.transaction([dbName], 'readwrite').objectStore(dbName).get(this.sessionID);

            r.fAPI = this;
            r.onsuccess = function(e) {
                blob = new Blob([hex2a(this.result.data)]);
                this.fAPI.dataURI = window.URL.createObjectURL(blob);
                db.transaction([dbName], 'readonly').objectStore(dbName).delete(this.sessionID);
            };
            r.onerror = function(e) {
                this.fAPI.fail('Failed to create URI');
            }
        }/*}}}*/
    },/*}}}*/

    clean: function() {/*{{{*/
        window.URL.revokeObjectURL(this.dataURI);
    }/*}}}*/
  };
}/*}}}*/

if (isWorker) {/*{{{*/
    var paused = 0;
    var parsed = 0;
    var avail = -1;
    self.addEventListener('message', function(e) {
        data = e.data.split(':');
        if (data[0] === 'dl') {
            fAPI = FileAPI();
            if (fAPI.dlLoop(data[1], data[2], data[3])) {
                self.postMessage('dlfail');
            } else {
                self.postMessage('done');
            }
        } else if (data[0] === 'decrypt') {
            fAPI = FileAPI();
            fAPI.decryptLoop();
        } else if (data[0] === 'noneAvail') {
            setTimeout(function() {fAPI = FileAPI(); fAPI.decryptLoop();}, 100);
        } else if (data[0] === 'avail') {
            fAPI = FileAPI();
            fAPI.decrypt(data[1], data[2], data[3], data[4]);
        }
    });
}/*}}}*/
