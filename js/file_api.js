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
    Allow three parallel downloads - should work, check variable collisions
    If download is killed in 'preparing' stage, files aren't removed because encryption still running
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

function FileAPIStub() {/*{{{*/
  return {
    populate: function(obj) {/*{{{*/
        this.sID = obj.sID,
        this.file = obj.file,
        this.title = obj.title,
        this.ttid = obj.ttid,
        this.type = obj.type,
        this.size = obj.size,
        this.state = obj.state,
        this.sKey = obj.sKey,
        this.startedAt = obj.startedAt,
        this.chunks = obj.chunks,
        this.received = this.chunks * 20480;
        this.chunksDecrypted = obj.chunksDecrypted,
        this.transferCompleted = obj.transferCompleted;
        this.storingCompleted = obj.storingCompleted;
        this.res = obj.res;
    },/*}}}*/

    fromFAPI: function(fAPI) {/*{{{*/
        this.sID = fAPI.sessionID;
        this.file = fAPI.file;
        this.title = fAPI.title;
        this.ttid = fAPI.ttid;
        this.type = fAPI.kind;
        this.size = fAPI.size;
        this.state = fAPI.state;
        this.sKey = fAPI.encKey;
        this.startedAt = fAPI.startedAt;
        this.chunks = fAPI.chunks;
        this.received = fAPI.chunks * 20480;
        this.chunksDecrypted = fAPI.chunksDecrypted;
        this.transferCompleted = fAPI.transferCompleted;
        this.storingCompleted = fAPI.storingCompleted;
        this.res = fAPI.res;
    },/*}}}*/

    toFAPI: function() {/*{{{*/
        fAPI = FileAPI();
        fAPI.sessionID = this.sID;
        fAPI.file = this.file;
        fAPI.title = this.title;
        fAPI.ttid = this.ttid;
        fAPI.type = this.kind;
        fAPI.size = this.size;
        fAPI.state = this.state;
        fAPI.sKey = this.encKey;
        fAPI.startedAt = this.startedAt;
        fAPI.chunks = this.chunks;
        fAPI.received = this.chunks * 20480;
        fAPI.chunksDecrypted = this.chunksDecrypted;
        fAPI.transferCompleted = this.transferCompleted;
        fAPI.storingCompleted = this.storingCompleted;
        fAPI.res = this.res;
        fAPI.paused = 1;
        return fAPI;
    },/*}}}*/

    toString: function() {/*{{{*/
        return JSON.stringify(this);
    },/*}}}*/

    fromString: function(str) {/*{{{*/
        return JSON.parse(str);
    }/*}}}*/
  };
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
    state: '',
    transferCompleted: 0,
    storingCompleted: 0,
    failed: 0,

    fs: undefined,
    kind: '',
    file: '',
    title: '',
    ttid: '',
    dataURI: undefined,
    encKey: undefined,

    size: undefined,
    res: 800,
    received: 0,
    chunkLength: 0,
    chunks: 0,
    chunksDecrypted: 0,
    decrypt1: 0,
    decrypt1Time: 0,
    decrypt2: 0,
    decrypt2Time: 0,
    decryptETA: '-- minutes',
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
            if (transferTime < 1.5) {this.res += 50;}
            else if (transferTime > 3) {this.res -= 50;}
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
    takeSnapshot: function() {/*{{{*/
        fAPIS = FileAPIStub();
        fAPIS.fromFAPI(this);
        return fAPIS;
    },/*}}}*/

    restoreSnapshot: function(fAPIS) {/*{{{*/
        this.sessionID = fAPIS.sID;
        this.file = fAPIS.file;
        this.kind = fAPIS.type;
        this.state = fAPIS.state;
        this.startedAt = fAPIS.startedAt;
        this.encKey = fAPIS.sKey;
        this.chunks = fAPIS.chunks;
        this.chunksDecrypted = fAPIS.chunksDecrypted;
        this.res = fAPIS.res;
        this.paused = 1;
    },/*}}}*/

    initialize: function(file, kind) {/*{{{*/
        this.updateStatus('Preparing download');
        this.file = file;
        this.kind = kind;
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.fAPI = this;
        this.currentXHRReq.onreadystatechange = function() {/*{{{*/
            if (this.readyState === 4 && this.status === 200 &&
                this.responseText.indexOf('nofile') === -1 &&
                this.responseText.indexOf('quota') === -1) {this.fAPI.start();}
            else if (this.responseText.indexOf('nofile') != -1) {this.fAPI.fail('File does not exist');}
            else if (this.responseText.indexOf('quota') != -1) {this.updateStatus('Waiting for download slot (max 3 simultaneous)');}
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
        if (this.paused) {
            this.state = 'initstr';
            this.setPaused();
        } else {
            this.initializeStorage();
        }
    },/*}}}*/

    pause: function() {/*{{{*/
        if (this.paused) {/*{{{*/
            this.paused = 0;
            if (this.status.indexOf('Pausing - ') > -1) {
                this.updateStatus(this.status.replace('Pausing - ', ''));
            }
            switch(this.state) {/*{{{*/
                case 'initstr':/*{{{*/
                    this.initializeStorage();
                    break;/*}}}*/
                case 'next':/*{{{*/
                    this.next();
                    break;/*}}}*/
                case 'workers':/*{{{*/
                    this.startWorkers();
                    break;/*}}}*/
                case 'workerloop':/*{{{*/
                    if (!this.fs) {
                        this.reinitFS();
                    }
                    if (!this.ajaxWorker || !this.cryptWorker) {/*{{{*/
                        this.ajaxWorker = new Worker('js/file_api.js');
                        this.ajaxWorker.fAPI = this;
                        this.cryptWorker = new Worker('js/file_api.js');
                        this.cryptWorker.fAPI = this;
                        this.cryptWorker.ajaxWorker = this.ajaxWorker;
                        this.ajaxWorker.cryptWorker = this.cryptWorker;
                        this.addWorkerListeners(this.ajaxWorker, this.cryptWorker);
                    }/*}}}*/
                    this.ajaxWorker.postMessage('resume');
                    this.cryptWorker.postMessage('resume');
                    this.cryptWorker.postMessage('decrypt');
                    if (!this.storingCompleted) {this.ajaxWorker.postMessage('getdlchunk:' + this.chunks);}
                    if (!this.transferCompleted) {var this_ = this; setTimeout(function() {this_.ajaxWorker.postMessage(['dl', fAPI.sessionID, fAPI.res, fAPI.encKey].join(':'))}, 250);}
                    if (this.transferCompleted && this.storingCompleted) {
                        this.updateStatus('Decrypting');
                        if (!this.progress) {
                            this.progress = this.chunksDecrypted / this.chunks;
                        }
                    } else if (this.transferCompleted && !this.storingCompleted) {
                        this.updateStatus('Storing transferred data');
                        this.progress = 1;
                    } else {
                        this.updateStatus('Downloading');
                        if (!this.progress) {
                            this.progress = this.received / this.size;
                        }
                    }
                    break;/*}}}*/
                case 'finishing':/*{{{*/
                    this.reinitFS();
                    this.finish();
                    break;/*}}}*/
            }/*}}}*/

            if (this.status === 'Decrypting') {
                this.decryptStatus(this, 0);
            }/*}}}*/
        } else {/*{{{*/
            this.updateStatus('Pausing - ' + this.status);
            this.paused = 1;
            if (this.cryptWorker) {
                this.cryptWorker.postMessage('pause');
            }
            if (this.ajaxWorker) {
                this.ajaxWorker.postMessage('pause');
            }
            // Ask user to wait while storing transferred chunks?
       }/*}}}*/
    },/*}}}*/

    setPaused: function() {/*{{{*/
        this.updateStatus('Paused');
        this.save();
    },/*}}}*/

    save: function() {/*{{{*/
        console.log(CryptoJS.MD5(this.sessionID).toString() + ' - Attempting to save state');
        fAPIS = this.takeSnapshot();
        saveReq = createPostReq('/file.cgi', true);
        saveReq.fAPI = this;
        saveReq.onreadystatechange = function() {
            if (reqCompleted(this)) {
                if (this.responseText != 'saved') {
                    console.log(CryptoJS.MD5(this.sessionID).toString() + ' - Failed to save, retrying');
                    this.fAPI.save();
                } else {
                    checkReq = createPostReq('/file.cgi', true);
                    checkReq.fAPI = this.fAPI;
                    checkReq.onreadystatechange = function() {
                        if (reqCompleted(this)) {
                            if (this.responseText.indexOf(this.fAPI.sessionID) == -1) {
                                console.log(CryptoJS.MD5(this.sessionID).toString() + ' - Failed to save, retrying');
                                this.fAPI.save();
                            } else {
                                console.log(CryptoJS.MD5(this.sessionID).toString() + ' - Saved');
                            }
                        }
                    };
                    checkReq.send('s=4');
                }
            }
        }
        saveReq.send('s=3&si=' + this.sessionID + '&fapis=' + fAPIS.toString());
    },/*}}}*/

    reinitFS: function() {/*{{{*/
        size = queuedTSize + (1024*1024*1024*1024) * Math.ceil(queuedTSize / (1024 * 1024 * 1024 *1024));
        if (navigator.webkitPersistentStorage) {
            fAPI = this;
            storageInfo.requestQuota(size, function(bytes) {fAPI.reinitBlob(fAPI, bytes)}, function(e) {fAPI.fail(fAPI, e);});
        } else {
            storageInfo.requestQuota(PERSISTENT, size, function(bytes) {fAPI.reinitBlob(fAPI, bytes)}, function(e) {fAPI.fail(fAPI, e);});
        }
    },/*}}}*/

    reinitBlob: function(fAPI, grantedBytes) {/*{{{*/
        requestFileSystem(PERSISTENT, grantedBytes, function(fs) {
            fAPI.fs = fs;
            fAPI.fs.fAPI = fAPI;

            fAPI.ajaxWorker.postMessage('resume');
            fAPI.cryptWorker.postMessage('resume');
            fAPI.cryptWorker.postMessage('decrypt');
            if (!fAPI.storingCompleted) {
                fAPI.ajaxWorker.postMessage('getdlchunk');
            }
            if (!fAPI.transferCompleted) {
                var this_ = fAPI;
                setTimeout(function() {this_.ajaxWorker.postMessage(['dl', this_.sessionID, this_.res, this_.encKey].join(':'))}, 100);
            }
        }, function(e) {console.log(e); fAPI.fail(fAPI, e);});
    },/*}}}*/

    initializeStorage: function() {/*{{{*/
        this.updateStatus('Creating local data store');
        size = queuedTSize + (1024*1024*1024*1024) * Math.ceil(queuedTSize / (1024 * 1024 * 1024 *1024));

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
        requestFileSystem(PERSISTENT, grantedBytes, function(fs) {fAPI.initData(fAPI, fs);}, function(e) {console.log(e); fAPI.fail(fAPI, e);});
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
        if (this.paused) {this.setPaused(); this.state = 'next'; this.chunkSpeed = '--'; this.avgSpeed = '--'; this.dispatchEvent('onprogressupdate'); return;}
        fAPI.startedAt = new Date().getTime();
        this.updateStatus('Downloading');
        this.startedChunkAt = new Date().getTime();
        if (workers) {this.startWorkers();}
        else {} // TODO download in main thread
    },/*}}}*/

    startWorkers: function() {/*{{{*/
        if (this.paused) {this.setPaused(); this.state = 'workers'; return;}
        this.ajaxWorker = new Worker('js/file_api.js');
        ajaxWorker = this.ajaxWorker;
        this.cryptWorker = new Worker('js/file_api.js');
        cryptWorker = this.cryptWorker;

        this.ajaxWorker.cryptWorker = cryptWorker;
        this.ajaxWorker.fAPI = this;
        this.cryptWorker.ajaxWorker = ajaxWorker;
        this.cryptWorker.fAPI = this;
        this.addWorkerListeners(this.ajaxWorker, this.cryptWorker);

        this.ajaxWorker.postMessage(['dl', this.sessionID, this.res, this.encKey].join(':'));
        setTimeout(function() {ajaxWorker.postMessage('getdlchunk');}, 200);
        this.cryptWorker.postMessage('decrypt');
    },/*}}}*/

    addWorkerListeners: function(ajaxWorker, cryptWorker) {/*{{{*/
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
            } else if (msg === 'noneAvail') {
                if (this.fAPI.paused) {
                    this.fAPI.state = 'workerloop';
                    this.fAPI.setPaused();
                } else {
                    setTimeout(function() {this.fAPI.ajaxWorker.postMessage('getdlchunk');}, 100);
                }
            } else if (msg.split('-')[0] === 'dlcomplete' &&
                       this.fAPI.status !== 'Decrypting' && this.fAPI.status !== 'Storing transferred data') {
                this.fAPI.updateStatus('Storing transferred data');
            } else if (msg.substr(0, 5) === 'data-') {
                num = msg.split('-')[1];
                data = msg.split('-')[2];
                this.fAPI.chunks++;
                this.fAPI.updateFile(this.fAPI.sessionID + '-' + num, num, data, 'text/plain', true,
                                     this.fAPI.partVerify, [this.fAPI, this, this.cryptWorker, 0]);
            } else if (msg === 'transferDone') {
                this.fAPI.transferCompleted = 1;
            } else if (msg === 'done') {
                this.fAPI.storingCompleted = 1;
                this.fAPI.updateStatus('Decrypting');
                this.terminate();
            }
        });/*}}}*/
        cryptWorker.addEventListener('message', function(m) {/*{{{*/
            msg = m.data;
            if (msg === 'appendFail') {
                this.fAPI.ajaxWorker.terminate();
                this.fAPI.fail('Failed to store decrypted data');
            } else if (msg === 'pausing') {
                this.fAPI.state = 'workerloop';
                this.fAPI.setPaused();
            } else if (msg === 'nextChunk') {
                if (this.fAPI.chunksDecrypted >= this.fAPI.chunks) {
                    this.postMessage('noneAvail');
                } else {
                    this.fAPI.getFile(this.fAPI.sessionID + '-' + this.fAPI.chunksDecrypted, this.fAPI.sendPart,
                         [this.fAPI.sessionID, this.fAPI.chunksDecrypted, this.fAPI.encKey, this.fAPI.cryptWorker]);
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
        if (this.paused) {this.state = 'workerloop'; this.setPaused(); return;}
        if (!data || data === NaN) {console.log(CryptoJS.MD5(sID).toString() + ' - Data blank - ' + num); cryptWorker.postMessage('noneAvail');}
        else {
            cryptWorker.postMessage(['avail', sID, num, key, data].join(':'));
        }
    },/*}}}*/

    dlLoop: function() {/*{{{*/
        if (self.paused) {return;}
        // This will return 0 on failure or completion
        if (self.paused || self.transferCompleted) {return 0;}
        self.fAPI.dl();
        if (!self.transferred || self.paused) {return 0;}
    },/*}}}*/

    dl: function() {/*{{{*/
        chunkReq = createPostReq('/file.cgi', true);
        self.postMessage('dl');
        chunkReq.send('s=1&si=' + self.sID + '&res=' + self.res);
        chunkReq.onreadystatechange = function() {
            if (reqCompleted(this)) {
                self.postMessage('dlend-' + this.responseText.length);
                text = chunkReq.responseText.split(':');
                for (i = 0; i < text.length; i++) {
                    if (text[i] === '' && i === (text.length - 1)) {break;}
                    if (text[i] === "<<#EOF#>>") {self.fAPI.transferCompleted = 1; self.transferCompleted = 1; self.postMessage('transferDone'); return;}
                    self.transferData.push(text[i]);
                    self.transferred++;
                }

                setTimeout(self.fAPI.dlLoop, 1);
            } else if (this.readyState == 4 && this.status != 200) {
                self.postMessage('dlfail');
            }
        };
    },/*}}}*/

    partVerify: function(fAPI, ajaxWorker, cryptWorker, repeat, name, part) {/*{{{*/
        if ((part.length === 0 || part === NaN) && !repeat) {
            console.log(CryptoJS.MD5(fAPI.sessionID).toString() + ' - Append failed - ' + name);
            fAPI.updateFile(name, name.split('-')[1], part, 'text/plain', true, fAPI.partVerify,
                            [fAPI, fAPI.ajaxWorker, fAPI.cryptWorker, 1]);
        } else if ((part.length === 0 || part === NaN) && repeat) {
            fAPI.ajaxWorker.terminate();
            fAPI.cryptWorker.terminate();
            fAPI.fail('Failed to store file part');
        } else {
            fAPI.endedChunkAt = new Date().getTime();
            if (fAPI.paused) {
                fAPI.state = 'workerloop';
                fAPI.setPaused();
            } else {
                fAPI.ajaxWorker.postMessage('getdlchunk');
            }
        }
    },/*}}}*/

    appendVerify: function(fAPI, ajaxWorker, cryptWorker, repeat, name, part) {/*{{{*/
        if ((part.length === 0 || part === NaN) && !repeat) {
            console.log(CryptoJS.MD5(fAPI.sessionID).toString() + ' - Append failed');
            fAPI.updateFile(name, 'data', part, 'text/plain', false, fAPI.appendVerify,
                            [fAPI, fAPI.ajaxWorker, fAPI.cryptWorker, 1]);
        } else if ((part.length === 0 || part === NaN) && repeat) {
            fAPI.ajaxWorker.terminate();
            fAPI.cryptWorker.terminate();
            fAPI.fail('Failed to append file part');
        } else {
            if (fAPI.chunksDecrypted <= fAPI.chunks && fAPI.status != 'Creating download link') {
                fAPI.chunksDecrypted++;
                fAPI.removeFile(fAPI.sessionID + '-' + (fAPI.chunksDecrypted - 1), fAPI.removeVerify, [this.fAPI, 0]);

                if (fAPI.status === 'Decrypting' && fAPI.chunksDecrypted === fAPI.chunks) {
                    fAPI.updateStatus('Creating download link');
                    if (fAPI.paused) {fAPI.state = 'finishing'; return;}
                    fAPI.finish();
                } else if (fAPI.chunksDecrypted >= fAPI.chunks) {
                    fAPI.cryptWorker.postMessage('noneAvail');
                } else {
                    if (fAPI.paused) {
                        fAPI.state = 'workerloop';
                        fAPI.setPaused();
                        return;
                    } else {
                        fAPI.getFile(fAPI.sessionID + '-' + fAPI.chunksDecrypted, fAPI.sendPart,
                            [fAPI.sessionID, fAPI.chunksDecrypted, fAPI.encKey, fAPI.cryptWorker]);
                    }
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
        if (!self.paused) {
            self.postMessage('nextChunk');
        } else {
            self.postMessage('pausing');
        }
    },/*}}}*/

    decrypt: function(sID, num, key, etxt) {/*{{{*/
        if (etxt === NaN) {return 1;}
        hex = CryptoJS.AES.decrypt(etxt, key, {mode: CryptoJS.mode.CBC}).toString();
        self.postMessage('data-' + num + '-' + hex);
    },/*}}}*/

    decryptStatus: function(fAPI, which) {/*{{{*/
        if (which) {
            fAPI.decrypt2 = fAPI.chunksDecrypted;
            fAPI.decrypt2Time = new Date().getTime();
            chunks = fAPI.decrypt2 - fAPI.decrypt1;
            timeDiff = (fAPI.decrypt2Time - fAPI.decrypt1Time) / 1000;
            fAPI.decryptETA = parseTime((fAPI.chunks - fAPI.chunksDecrypted) / (chunks / timeDiff))[0];
            if (!self.paused) {
                setTimeout(function() {fAPI.decryptStatus(fAPI, 0)}, 750);
            }
        } else {
            fAPI.decrypt1 = fAPI.chunksDecrypted;
            fAPI.decrypt1Time = new Date().getTime();
            if (!self.paused) {
                setTimeout(function() {fAPI.decryptStatus(fAPI, 1)}, 750);
            }
        }
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
        if (this.ajaxWorker) {this.ajaxWorker.terminate();}
        if (this.cryptWorker) {this.cryptWorker.terminate();}
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.send('s=2&si=' + this.sessionID);
        if (this.dataURI) {window.URL.revokeObjectURL(this.dataURI);}
        if (this.fs) {
            for (i = 0; i < this.chunks; i++) {
                this.removeFile(this.sessionID + '-' + i, this.removeVerify, [this, 0]);
            }
            this.removeFile(this.sessionID, this.removeVerify, [this, 0]);
        }
    }/*}}}*/
  };
}/*}}}*/

self.paused = 0;
self.active = 0;
self.transferCompleted = 0;
self.numTransferred = 0;
self.transferred = 0;
self.transferData = [];
self.sID = '';
self.res = '';
self.k = '';
if (isWorker) {/*{{{*/
    self.addEventListener('message', function(e) {
        data = e.data.split(':');
        if (data[0] === 'dl') {/*{{{*/
            if (!self.active) {
                self.active = 1;
                if (data.length > 1) {
                    self.fAPI = FileAPI();
                    self.fAPI.transferCompleted = 0;
                    self.fAPI.storingCompleted = 0;
                    self.sID = data[1];
                    self.res = data[2]
                    self.k = data[3];
                }
                self.fAPI.dlLoop();
            }/*}}}*/
        } else if (data[0] === 'getdlchunk') {/*{{{*/
            if (data.length > 1) {self.numTransferred = data[1];}
            if (!self.transferData.length) {
                if (self.transferCompleted) {
                    self.fAPI.storingCompleted = 1;
                    self.postMessage('done');
                } else {
                    self.postMessage('noneAvail');
                }
            } else {
                if (self.transferCompleted) {self.postMessage('dlcomplete');}
                c = self.transferData.shift();
                self.postMessage('data-' + self.numTransferred + '-' + c);
                self.numTransferred++;
            }/*}}}*/
        } else if (data[0] === 'decrypt') {/*{{{*/
            if (!self.active) {
                self.fAPI = FileAPI();
                self.fAPI.decryptLoop();
            }/*}}}*/
        } else if (data[0] === 'noneAvail') {/*{{{*/
            if (!self.paused) {
                setTimeout(function() {self.fAPI.decryptLoop();}, 100);
            }/*}}}*/
        } else if (data[0] === 'avail') {/*{{{*/
            self.fAPI.decrypt(data[1], data[2], data[3], data[4]);/*}}}*/
        } else if (data[0] === 'pause') {/*{{{*/
            self.active = 0;
            self.paused = 1;/*}}}*/
        } else if (data[0] === 'resume') {/*{{{*/
            self.paused = 0;/*}}}*/
        }
    });
}/*}}}*/
