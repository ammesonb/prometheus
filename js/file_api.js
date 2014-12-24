window = this;
isWorker = (typeof importScripts === 'function');
notWorker = !isWorker;
workers = !!window.Worker;
// Google Chrome
M_GC = 0;
// Firefox
M_FF = 1;
S_200K = 204800;
S_1M = 1048576;
S_100M = 104857600;

mode = M_GC;
// Pause button?
// If not worker, use asynchronous methods/*{{{*/
if (notWorker) {
    // Check if File System API supported
    requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    storageInfo = navigator.webkitPersistentStorage || window.webkitStorageInfo;
    resolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL;

    // If not, drop to Indexed DB/*{{{*/
    if (!requestFileSystem) {
        mode = M_FF;
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
    importScripts('aes.js');
    importScripts('site.js');
    self.requestFileSystem = self.webkitRequestFileSystemSync || self.requestFileSystemSync;
}/*}}}*/

function FileAPI() {/*{{{*/
    return {
        // Attributes/*{{{*/
        events: {},
        status: 'Requested',
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
        received: 0,
        chunkLength: 0,
        currentData: '',
        res: S_200K * .1,
        avgSpeed: 0,
        startedAt: undefined,
        firstChunk: true,
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
                if (this.events[type][e].action == f) {this.events[type].splice(e, 1);}
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
        // Change time into seconds
        totalTime /= 1000;
        transferTime /= 1000;
        console.log('Transfer - ' + transferTime);
        console.log('Transferred - ' + bytesTransferred);
        console.log('Res - ' + this.res);
        console.log('Total - ' + totalTime);
        // this.received += bytesTransferred;
        this.progress = this.received / this.size;
        this.chunkSpeed = bytesTransferred / totalTime;
        this.avgSpeed = this.received / ((new Date().getTime() - this.startedAt) / 1000);
        if (this.failed) {this.progress = '--';}
        else {this.progress = this.progress.toFixed(4);}

        //if (transferTime < 1 || transferTime > 3) {this.res = 1.5 * (bytesTransferred / transferTime);}
        /*timeRatio = transferTime / totalTime;
        if (timeRatio < .1) {this.res *= parseInt(.1 / timeRatio, 10);}
        else if (timeRatio > .3) {this.res *= parseInt(.3 / timeRatio);}
        if (!this.res) {this.res = S_1M;}
        else if (this.res > S_100M) {this.res = S_100M;}
        console.log('New res - ' + this.res);*/
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
            if (this.readyState == 4 && this.status == 200 && this.responseText.indexOf('nofile') == -1) {this.fAPI.start();}
            else if (this.responseText.indexOf('nofile') != -1) {this.fAPI.fail('File does not exist');}
            else if (this.readyState == 4) {this.fAPI.fail('Internal error - contact me');}
        };/*}}}*/
        this.currentXHRReq.send('s=0&f=' + file + '&k=' + kind);
    },/*}}}*/

    start: function() {/*{{{*/
        this.updateStatus('Loading session data');
        data = this.currentXHRReq.responseText.split(';;;');
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

        if (mode == M_FF) {/*{{{*/
            trans = db.transaction([dbName], "readwrite");
            trans.fAPI = this;
            trans.oncomplete = function(e) {this.fAPI.startedAt = new Date().getTime(); this.fAPI.next();}
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
        fAPI.fs.root.getFile(fAPI.sessionID + '-avail', {create: true}, function(fileEntry) {/*{{{*/
            fileEntry.fAPI = fAPI;
            fileEntry.createWriter(function(writer) {
                writer.fAPI = fAPI;
                writer.onwritestart = function() {fAPI.updateStatus("Creating data availability object");};
                writer.onwriteend = function() {fAPI.updateStatus("Created");};
                blob = new Blob(['0'], {type: 'text/plain'});
                writer.write(blob);
            }, fAPI.fail);
        }, function(e) {fAPI.fail(fAPI, e);});/*}}}*/
        fAPI.fs.root.getFile(fAPI.sessionID, {create: true}, function(fileEntry) {/*{{{*/
            fileEntry.fAPI = fAPI;
            fileEntry.createWriter(function(writer) {
                writer.fAPI = fAPI;
                writer.onwritestart = function() {fAPI.updateStatus("Creating data object");};
                writer.onwriteend = function() {fAPI.updateStatus("Created"); fAPI.startedAt = new Date().getTime(); fAPI.next();};
                blob = new Blob([''], {type: 'text/plain'});
                writer.write(blob);
            }, fAPI.fail);
        }, function(e) {fAPI.fail(fAPI, e);});/*}}}*/
    },/*}}}*/

    next: function() {/*{{{*/
        if (this.paused) {this.updateStatus('Paused'); this.chunkSpeed = '--'; this.avgSpeed = '--'; this.dispatchEvent('onprogressupdate'); return;}
        this.updateStatus('Downloading');
        this.currentData = '';
        this.firstChunk = true;
        this.startedChunkAt = new Date().getTime();
        if (workers) {
            w = new Worker('js/file_api.js');
            w.postMessage(['getChunk', this.sessionID, this.res, this.encKey].join(':'));
            w.fAPI = this;
            w.addEventListener('message', function(e) {/*{{{*/
                if (typeof(e.data) != "object") {/*{{{*/
                    if (e.data == 'parse') {
                        this.fAPI.incrementAvail(this.fAPI.sessionID);
                    } else if (e.data == 'fail') {
                        this.fAPI.fail('Failed to obtain next chunk');
                    } else if (e.data == 'load') {
                        this.fAPI.startedChunkTransferAt = new Date().getTime();
                    } else if (e.data == 'decrypt') {
                        this.fAPI.endedChunkTransferAt = new Date().getTime();
                        this.fAPI.updateStatus('Decrypting');
                    } else if (/^\d+$/.test(e.data)) {
                        this.fAPI.chunkLength = parseInt(e.data, 10);
                        this.fAPI.received += this.fAPI.chunkLength;
                    } else {
                        console.log(e.data);
                    }/*}}}*/
                } else {/*{{{*/
                    this.fAPI.storeChunk();
                    w.terminate();
                    this.fAPI.resume();
                }/*}}}*/
            });/*}}}*/
        } else {
            this.getChunk();
        }
    },/*}}}*/

    next: function() {/*{{{*/
        if (this.paused) {this.updateStatus('Paused'); this.chunkSpeed = '--'; this.avgSpeed = '--'; this.dispatchEvent('onprogressupdate'); return;}
        this.updateStatus('Downloading');
        this.startedChunkAt = new Date().getTime();
        if (workers) {startWorkers();}
        else {// manual}
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
            } else if (msg === 'dlend') {
                this.fAPI.endedChunkTransferAt = new Date().getTime();
            } else if (msg === 'parse') {
                this.fAPI.incrementParsed();
                this.updateProgress(this.chunkLength, this.endedChunkTransferAt - this.startedChunkTransferAt, this.endedChunkAt - this.startedChunkAt);
            } else if (msg === 'dlfail') {
                this.cryptWorker.terminate();
                this.fAPI.fail('Download failed');
            }
        });/*}}}*/

        cryptWorker.ajaxWorker = ajaxWorker;
        cryptWorker.fAPI = this;
        cryptWorker.postMessage(['decrypt', this.sessionID].join(':'));
        cryptWorker.addEventListener('message', function(m) {/*{{{*/
            msg = m.data;
            if (msg === 'getAvail') {
                self.fAPI.getAvail(cryptWorker.fAPI.sessionID, this);
            }
        });/*}}}*/
    },/*}}}*/

    getAvail: function(sID, cryptWorker) {/*{{{*/
        if (mode == M_FF) {/*{{{*/
            trans = db.transaction([dbName]);
            trans.fAPI = this;
            obj = trans.objectStore(dbName);
            req = obj.get(sID);
            req.onsuccess = function(e) {cryptWorker.postMessage('avail:' + this.result.avail);};
            req.onerror = function(e) {this.fAPI.fail('Failed to get available data quantity');}/*}}}*/
        } else {/*{{{*/
            this.fs.fAPI = this;
            this.fs.root.getFile(fAPI.sessionID + '-avail', {}, function(fE) {
                fE.fAPI = fAPI;
                fE.createReader(function(reader) {
                    reader.onloadend = function(e) {
                        cryptWorker.postMessage('avail:' + this.result);
                    };
                    reader.readAsText(fE);
                });
            }, function(e) {fAPI.fail(fAPI, e); return -1;});
        }/*}}}*/
    },/*}}}*/

    incrementAvail: function(sID, num) {/*{{{*/
    },/*}}}*/

    dlLoop: function(sID, res, k) {/*{{{*/
        if (paused) {return;}
        // Need some way to determine loop termination - and set up loop
        while (true) {
            if (dl(sID, res, k)) {self.terminate();}
            self.postMessage('parse');
        }
    },/*}}}*/

    dl: function(sID, res, k) {/*{{{*/
        chunkReq = createPostReq('/file.cgi', false);
        self.postMessage('dl');
        chunkReq.send();
        self.postMessage('dlend');
        if (chunkReq.status != 200) {self.postMessage('dlfail'); return 1;}
        sent = chunkReq.responseText.length;
        return storePart(sID, chunkReq.responseText);
    },/*}}}*/

    storePart: function(sID, data) {/*{{{*/
        if (data.indexOf('<<#EOF#>>') != -1) {self.postMessage('done');}
        // Store data
        return 0;
    },/*}}}*/

    decryptLoop: function(sID) {/*{{{*/
        avail = -1;
        self.postMessage('getAvail');
        // Need to spawn another worker above first
        // Send a get_parse message and then do a while avail == -1 loop until set
        while (parsed < avail) {
            if (paused) {return;}
            this.decrypt(sID, parsed);
            parsed++;
        }

        setTimeout(function() {decryptLoop(sID);}, 500);
    },/*}}}*/

    decrypt: function(sID, num) {/*{{{*/
        data = '';
        append(sID, data);
    },/*}}}*/

    append: function(sID, data) {/*{{{*/
    },/*}}}*/

    getChunk: function(sID, res, k) {/*{{{*/
        if (isWorker) {/*{{{*/
            chunkReq = createPostReq('/file.cgi', true);
            chunkReq.firstChunk = true;
            chunkReq.onreadystatechange = function() {
                if (this.readyState == 3 && this.firstChunk) {this.firstChunk = false; self.postMessage('load');}
                else if (this.readyState == 4) {
                    if (this.status != 200) {self.postMessage('fail');}
                    else {
                        self.postMessage(this.responseText.length);
                        self.postMessage('decrypt');
                        hex = new Blob([CryptoJS.AES.decrypt(this.responseText, k, {mode: CryptoJS.mode.CBC}).toString()], {type: 'Application/octet-stream'});
                        /*offset = 0;
                        iterSize = S_200K;

                       while (offset < hex.size) {
                            hexChunk = hex.slice(offset, offset + iterSize);
                            fr = new FileReader();
                            fr.onload = function() {
                                self.postMessage(this.result);
                                offset += iterSize;
                            }
                            fr.readAsText(hexChunk);
                            while (!self.readyToParse) {}
                            self.readyToParse = false;
                        }*/
                        self.postMessage(hex);
                        self.postMessage('____<<<#EOA#>>>____');
                        // While reading, pass data as it is read and increment offset?
                            // Use abort, but then how to offset string from decryption?
                        // Use oncomplete for termination postMessage
                        /*iterSize = S_200K;
                        while (hex.data.length) {
                            if (hex.data.length < iterSize) {iterSize = hex.data.length;}
                            self.postMessage(hex.data.substr(0, iterSize));
                            hex.data = hex.data.substr(iterSize);
                        }*/
                    }
                }
            };
            chunkReq.send('s=1&si=' + sID + '&r=' + res);
            /*}}}*/
        } else {/*{{{*/
            this.currentXHRReq = createPostReq('/file.cgi', true);
            this.currentXHRReq.fAPI = this;
            this.currentXHRReq.onreadystatechange = function() {
                if (this.readyState == 3 && this.fAPI.firstChunk) {
                    this.fAPI.firstChunk = false;
                    this.fAPI.startedChunkTransferAt = new Date().getTime();
                } else if (this.readyState == 4 && this.status == 200) {
                    this.fAPI.updateStatus('Decrypting');
                    this.fAPI.endedChunkTransferAt = new Date().getTime();
                    this.fAPI.chunkLength = this.responseText.length;
                    this.fAPI.received += this.fAPI.chunkLength;
                    this.fAPI.currentData = CryptoJS.AES.decrypt(this.responseText, this.fAPI.encKey, {mode: CryptoJS.mode.CBC}).toString();
                    this.fAPI.storeChunk();
                } else if (this.readyState == 4 && this.status != 200) {
                    this.fAPI.currentData = 'fail';
                }
            };
            this.currentXHRReq.send('s=1&si=' + this.sessionID + '&r=' + this.res);
        }/*}}}*/
    },/*}}}*/

    storeChunk: function() {/*{{{*/
        if (this.currentData == 'fail') {
            this.fail('Couldn\'t obtain next chunk');
        } else {
            this.updateStatus('Storing chunk');
        }

        fr = new FileReader();
        fr.fAPI = this;
        fr.onloadend = function() {
            if (this.result.indexOf('<<#EOF#>>') != -1) {
                this.fAPI.completed = true;
                this.fAPI.currentData = this.fAPI.currentData.slice(0, -18);
            }
        }
        fr.readAsText(new Blob([hex2a(this.currentData)]));

        if (mode == M_GC) {/*{{{*/
            fAPI = this;
            this.fs.root.getFile(this.sessionID, {create: false}, function(fileEntry) {
                fileEntry.fAPI = this;
                fileEntry.createWriter(function(w) {
                    w.seek(w.length);
                    w.write(this.fAPI.currentData);
                }, function(e) {fAPI.fail('Failed to open file for writing');});
            }, function(e) {fAPI.fail('Failed to open cache');});/*}}}*/
        } else {/*{{{*/
            obj = db.transaction([dbName], "readwrite").objectStore(dbName);
            req = obj.get(this.sessionID);
            req.fAPI = this;
            req.onsuccess = function(e) {
                this.fAPI.updateStatus('Appending data');
                // Need to do filereader to get data from currentData
                fr = new FileReader();
                fr.fAPI = this;
                fr.req = req;
                fr.onloadend = function(e) {
                    this.req.result.data += this.fAPI.currentData;
                    this.fAPI.updateStatus('Storing data');
                    reqUpdate = obj.put(this.req.result);
                    reqUpdate.fAPI = this.fAPI;

                    reqUpdate.onerror = function(e) {
                        this.fAPI.fail('Failed to save data');
                    };
                }
                fr.readAsText(this.fAPI.currentData);

            };

            req.onerror = function(e) {
                this.fAPI.fail('Failed to open cache');
            }
        }/*}}}*/
    },/*}}}*/

    resume: function() {/*{{{*/
        this.endedChunkAt = new Date().getTime();
        this.paused = false;
        this.stored = false;
        this.updateStatus('Chunk stored');
        this.updateProgress(this.chunkLength, this.endedChunkTransferAt - this.startedChunkTransferAt, this.endedChunkAt - this.startedChunkAt);

        if (this.completed) {
            this.finish();
        } else {
            this.next();
        }
    },/*}}}*/

    finish: function() {/*{{{*/
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.send('s=2&si=' + this.sessionID);
        this.currentData = undefined;
        this.currentXHRReq = undefined;

        if (mode == M_GC) {/*{{{*/
            fAPI = this;
            this.fs.root.getFile(this.sessionID, {create: false}, function(entry) {
                entry.fAPI = fAPI;
                entry.file(function(file) {
                    fr = new FileReader();
                    fr.fAPI = this.fAPI;
                    fr.onloadend = function(e) {
                        b = new Blob([hex2a(this.result)]);
                        this.fAPI.dataURI = window.URL.createObjectURL(b);
                        entry.remove(function() {}, function() {});
                    };
                    fr.readAsText(file);
                }, function(e) {
                    this.fAPI.fail('Failed to read file');
                });
            }, function(e) {
                this.fAPI.fail('Failed to create URI');
            });/*}}}*/
        } else if (mode == M_FF) {/*{{{*/
            this.updateStatus("Creating URI for file");
            r = db.transaction([dbName], 'readwrite').objectStore(dbName).get(this.sessionID);

            r.fAPI = this;
            r.onsuccess = function(e) {
                b = new Blob([hex2a(this.result.data)]);
                this.fAPI.dataURI = window.URL.createObjectURL(b);
                db.transaction([dbName], 'readonly').objectStore(dbName).delete(this.sessionID);
            };
            r.onerror = function(e) {
                this.fAPI.fail('Failed to create URI');
            }
        }/*}}}*/

        this.updateStatus('Complete');
        this.dispatchEvent('oncomplete');
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
    self.readyToParse = false;
    self.addEventListener('message', function(e) {
        data = e.data.split(':');
        if (data[0] == 'getChunk') {/*{{{*/
            fAPI = FileAPI();
            fAPI.getChunk(data[1], data[2], data[3]);/*}}}*/
        } else if (data[0] == 'next') {
            self.readyToParse = true;
        } else if (data[0] === 'avail') {
            avail = parseInt(data[0].split(':')[1], 10);
        }
    });
}/*}}}*/
