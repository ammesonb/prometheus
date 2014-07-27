window = this;
isWorker = (typeof importScripts === 'function');
notWorker = !isWorker;
workers = !!window.Worker;
// Google Chrome
M_GC = 0;
// Firefox
M_FF = 1;

mode = M_GC;
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
        status: 'Constructed',
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
        currentData: '',
        res: 1000000,
        totalSpeed: 0,
        startedAt: undefined,
        chunkSpeed: 0,
        startedChunkAt: 0,
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

    updateProgress: function(bytesTransferred, time) {/*{{{*/
        // Change time into seconds
        time /= 1000;
        //if (time < 2 || time > 5) {this.res = (bytesTransferred / time) * 3;}
        // this.received += bytesTransferred;
        this.progress = this.received / this.size;
        this.chunkSpeed = bytesTransferred / time;
        this.chunkSpeed /= 1024;
        this.totalSpeed = this.received / ((new Date().getTime() - this.startedAt) / 1000);
        this.totalSpeed /= 1024;
        if (this.failed) {this.progress = '--';}
        else {this.progress = this.progress.toFixed(2);}
        this.chunkSpeed = this.chunkSpeed.toFixed(2);
        this.totalSpeed = this.totalSpeed.toFixed(2);
        this.dispatchEvent('onprogressupdate');
    },/*}}}*/

    fail: function(text) {/*{{{*/
        if (text) {
            this.updateStatus(text);
        } else {
            this.updateStatus('Failed');
        }
        this.received = -1;
        this.chunkSpeed = '--';
        this.totalSpeed = '--';
        this.dispatchEvent('onprogressupdate');
        this.dispatchEvent('onfail');
    },/*}}}*//*}}}*/

    // Functions
    initialize: function(file, kind) {/*{{{*/
        this.file = file;
        this.kind = kind;
        this.updateStatus('Initializing');
        this.currentXHRReq = createPostReq('/file.cgi', true);
        this.currentXHRReq.fAPI = this;
        this.currentXHRReq.onreadystatechange = function() {/*{{{*/
            if (this.readyState == 4 && this.status == 200 && this.responseText.indexOf('nofile') == -1) {this.fAPI.start();}
            else if (this.responseText.indexOf('nofile') != -1) {this.fAPI.fail('File does not exist');}
            else if (this.readyState == 4) {this.fAPI.fail('Internal error - contact me');}
        };/*}}}*/
        this.currentXHRReq.send('s=0&f=' + file + '&k=' + kind);
        this.updateStatus('Retrieving session data');
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
            obj.put({sessionID: this.sessionID, data: ''});/*}}}*/
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
        fAPI.fs.root.getFile(fAPI.sessionID, {create: true}, function(fileEntry) {
            fileEntry.fAPI = fAPI;
            fileEntry.createWriter(function(writer) {
                writer.fAPI = fAPI;
                writer.onwritestart = function() {fAPI.updateStatus("Creating data object");};
                writer.onwriteend = function() {fAPI.updateStatus("Created"); fAPI.startedAt = new Date().getTime(); fAPI.next();};
                blob = new Blob([''], {type: 'text/plain'});
                writer.write(blob);
            }, fAPI.fail);
        }, function(e) {fAPI.fail(fAPI, e);});
    },/*}}}*/

    next: function() {/*{{{*/
        if (this.paused) {this.updateStatus('Paused'); this.chunkSpeed = '--'; this.totalSpeed = '--'; this.dispatchEvent('onprogressupdate');}
        this.updateStatus('Downloading');
        this.startedChunkAt = new Date().getTime();
        if (workers) {
            w = new Worker('js/file_api.js');
            w.postMessage(['getChunk', this.sessionID, this.res, this.encKey].join(':'));
            w.fAPI = this;
            w.addEventListener('message', function(e) {
                if (e.data.length < 10 || /^\d+$/.test(e.data)) {
                    if (e.data == 'fail') {
                        this.fAPI.fail('Failed to obtain next chunk');
                    } else if (e.data == 'decrypt') {
                        this.fAPI.updateStatus('Decrypting');
                    } else {
                        this.fAPI.received += parseInt(e.data, 10);
                    }
                } else {
                    this.fAPI.currentData = e.data; this.terminate(); this.fAPI.storeChunk();
                }
            });
        } else {
            this.getChunk();
        }
    },/*}}}*/

    getChunk: function(sID, res, k) {/*{{{*/
        if (isWorker) {/*{{{*/
            chunkReq = createPostReq('/file.cgi', false);
            chunkReq.send('s=1&si=' + sID + '&r=' + res);
            if (chunkReq.status != 200 && chunkReq.readyState == 4) {self.postMessage('fail');}
            else {
                self.postMessage(chunkReq.responseText.length);
                self.postMessage('decrypt');
                self.postMessage(CryptoJS.AES.decrypt(chunkReq.responseText, k, {mode: CryptoJS.mode.CBC}).toString());
            }/*}}}*/
        } else {/*{{{*/
            this.currentXHRReq = createPostReq('/file.cgi', true);
            this.currentXHRReq.fAPI = this;
            this.currentXHRReq.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    this.fAPI.received += this.responseText.length;
                    this.fAPI.updateStatus('Decrypting');
                    this.fAPI.currentData = CryptoJS.AES.decrypt(this.responseText, this.fAPI.encKeyi, {mode: CryptoJS.mode.CBC}).toString();
                } else {
                    this.fAPI.currentData = 'fail';
                }
                this.fAPI.storeChunk();
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
        fr.onload = function() {
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
                    w.fAPI = this.fAPI;
                    w.onwriteend = function() {this.fAPI.resume();}
                    w.seek(w.length);
                    blob = new Blob([this.fAPI.currentData], {type: 'Application/octet-stream'});
                    w.write(blob);
                }, function(e) {fAPI.fail('Failed to open file for writing');});
            }, function(e) {fAPI.fail('Failed to open cache');});/*}}}*/
        } else {/*{{{*/
            obj = db.transaction([dbName], "readwrite").objectStore(dbName);
            req = obj.get(this.sessionID);
            req.fAPI = this;
            req.onsuccess = function(e) {
                this.fAPI.updateStatus('Appending data');
                this.result.data += this.fAPI.currentData;
                this.fAPI.updateStatus('Storing data');
                reqUpdate = obj.put(this.result);
                reqUpdate.fAPI = this.fAPI;

                reqUpdate.onsuccess = function(e) {
                    this.fAPI.resume();
                };

                reqUpdate.onerror = function(e) {
                    this.fAPI.fail('Failed to save data');
                };
            };

            req.onerror = function(e) {
                this.fAPI.fail('Failed to open cache');
            }
        }/*}}}*/
    },/*}}}*/

    resume: function() {/*{{{*/
        this.paused = false;
        this.stored = false;
        this.endedChunkAt = new Date().getTime();
        this.updateStatus('Chunk stored');
        this.updateProgress(this.currentData.length, this.endedChunkAt - this.startedChunkAt);

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
    self.addEventListener('message', function(e) {
        data = e.data.split(':');
        if (data[0] == 'getChunk') {/*{{{*/
            fAPI = FileAPI();
            fAPI.getChunk(data[1], data[2], data[3]);/*}}}*/
        }
    });
}/*}}}*/
