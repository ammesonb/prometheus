/*{{{*/ /* TODO
*/ /*}}}*/

/* Global variables *//*{{{*/
var colors = ['#FF1300', '#FF6A00', '#FFA540', '#FFD240', '#9BED00', '#37DB79', '#63ADD0', '#7872D8', '#4B5BD8', '#9A3ED5', '#7F4BA0', '#ED3B83', '#999'];

// Tasks/*{{{*/
var expanded = [];
var tasks = [];
var sortedTasks = [];
var tasksByID = [];
var projects = [];
var rootProjects = [];
var subProjects = [];
var projectsByID = [];
var projectHierarchy = [];/*}}}*/

// Reminders/*{{{*/
var reminders = [];
var smsContacts = [];/*}}}*/

// Users/*{{{*/
var domains = [];
var services = [];
var userServices = [];
var users = [];/*}}}*/

media = {/*{{{*/
    'movies': [],
    'mSeries': [],
    'mGenres': [],
    'movieGenres': [],
    'tv': [],
    'tSeries': [],
    'tGenres': [],
    'tvGenres': []
};/*}}}*/

var requestingFS = 0;
var queuedDL = 0;
var queuedSize = 0;
var queuedTSize = 0;
var MAX_DL = 3;
/*}}}*/

/* General functions *//*{{{*/
function alertNoAuth() {/*{{{*/
    alert('Session timed out! Please copy any unsaved changes then refresh the page.');
}/*}}}*/

function alertDisabled() {/*{{{*/
    alert('You tried to edit something that does not belong to you! Your account has been disabled.');
    window.location.reload();
}/*}}}*/

function element(e) {/*{{{*/
    return document.createElement(e);
}/*}}}*/

function createDateInput() {/*{{{*/
    dateInput = element('input');
    dateInput.className = 'normal_text';
    dateInput.type = 'datetime-local'; 
    dateInput.onclick = function() {/*{{{*/
        this.readOnly = false;
        this.previousElementSibling.previousElementSibling.checked = true;
    };/*}}}*/

    // If datetime input type isn't supported /*{{{*/
    if (dateInput.type == 'text') {
        if (dateInput.value == '') {
            dateInput.value = 'YYYY-MM-DD HH:MM';
        } else {dateInput.value = dateInput.value.replace('T', ' ');}
        dateInput.onchange = function() { /*{{{*/
            year = /[0-9]{4}-/;
            month = /(0[1-9]|1[0-2])-/;
            date = /(0[1-9]|[12][0-9]|3[01])/;
            hour = / ([01][0-9]|2[0-3]):/;
            minute = /[0-5][0-9]/;
            yearValid = 1;
            monthValid = 1;
            dateValid = 1;
            hourValid = 1;
            minuteValid = 1;

            v = this.value;
            newValue = '';
            // Verify date and time validity, reset if invalid otherwise keep /*{{{*/
            if (!year.test(v.substr(0, 5))) {
                yearValid = 0;
                newValue += 'YYYY-';
            } else {newValue += v.substr(0, 5);}
            if (!month.test(v.substr(5, 3))) {
                monthValid = 0;
                newValue += 'MM-';
            } else {newValue += v.substr(5, 3);}
            if (!date.test(v.substr(8, 2))) {
                dateValid = 0;
                newValue += 'DD';
            } else {newValue += v.substr(8, 2);}
            if (!hour.test(v.substr(10, 4))) {
                hourValid = 0;
                newValue += ' HH:';
            } else {newValue += v.substr(10, 4);}
            if (!minute.test(v.substr(14, 2))) {
                minuteValid = 0;
                newValue += 'MM';
            } else {newValue += v.substr(14, 2);}
            this.value = newValue; /*}}}*/
        } /*}}}*/
    } /*}}}*/

    return dateInput;
}/*}}}*/

function verifyNum(value, min, max) {/*{{{*/
    if (isNaN(value)) {return 1;}
    else if (min <= parseInt(value, 10) && parseInt(value, 10) <= max) {return value;}
    else {return min;}
}/*}}}*/

function a2hex(str) {/*{{{*/
    result = '';
    for (i=0; i<str.length; i++) {
        hex = str.charCodeAt(i).toString(16);
        result += hex;
    }
    return result;
}/*}}}*/

function hex2a(hexx) {/*{{{*/
    hex = hexx.toString();//force conversion
    arr = new Uint8Array(new ArrayBuffer(hexx.length / 2));
    for (var i = 0; i < hex.length; i += 2)
        arr[i / 2] = parseInt(hex.substr(i, 2), 16);
    return arr;
}/*}}}*/

function parseSize(bytes) {/*{{{*/
    if (bytes === '--') {return ['--', 'B'];}
    else if (bytes === 'Unknown') {return ['Unknown', 'B'];}
    units = ['B', 'KB', 'MB', 'GB'];
    base = 1;
    for (u = 0; u < units.length; u++) {/*{{{*/
        unit = units[u];
        tmpSize = bytes / base;
        tmpSize = tmpSize.toFixed(2);
        if (tmpSize < 2048) {
            return [tmpSize + '\u00a0' + unit, unit];
        }
        base *= 1024;
    }/*}}}*/
}/*}}}*/

function parseTime(tmpT) {/*{{{*/
    units = ['d', 'h', 'm', 's'];
    conversions = [24 * 60 * 60, 60 * 60, 60];
    fractions = [24, 60, 60];
    u = 0;
    while (tmpT < conversions[u]) {u++;}
    if (u == conversions.length) {return [tmpT.toFixed(2) + ' s', 's'];}
    tmpT = tmpT / conversions[u];
    tmpI = parseInt(tmpT, 10);
    tmpF = parseInt(tmpT % 1 * fractions[u], 10);
    if (u != 0) {
        if (tmpF < 10) {tmpF = '0' + tmpF;}
        return [tmpI + ':' + tmpF + ' ' + units[u], units[u]];
    } else {
        return [tmpI + ' days ' + tmpF + ' hours', units[0]];
    }

}/*}}}*/

function update() {/*{{{*/
    var docHeadObj = document.getElementsByTagName('head')[0];
    var newScript = element('script');
    newScript.type = 'text/javascript';
    newScript.src = 'js/site.js';
    docHeadObj.appendChild(newScript);

    document.getElementsByTagName('link')[0].remove();

    var newStyle = element('link');
    newStyle.rel = 'stylesheet';
    newStyle.type = 'text/css';
    newStyle.href = 'res/style.css';
    docHeadObj.appendChild(newStyle);
    
    currentTabs = document.getElementsByClassName('tab');
    services = [];
    for (t = 0; t < currentTabs.length; t++) {
        tID = currentTabs[t].getAttribute('data-id');
        if (!tID) {continue;}
        service = tID.split('_')[0];
        if (services.indexOf(service) == -1) {services.push(service);}
    }

    if (services.indexOf('tasks') != -1) {setTimeout(function() {fetchTaskData();}, 1000);}
}/*}}}*/

function createPostReq(url, mode) { /*{{{*/
    req = new XMLHttpRequest();
    req.open('POST', url, mode);
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    return req;
} /*}}}*/

function reqFailed(req) {/*{{{*/
    return ((req.readyState == 4 && req.status != 200) ||
      (req.readyState == 4 && req.status == 200 && req.responseText != 'success'));
}/*}}}*/

function reqCompleted(req) {/*{{{*/
    return req.readyState == 4 && req.status == 200;
}/*}}}*/

function reqSuccessful(req) {/*{{{*/
    return req.readyState == 4 && req.status == 200 && req.responseText == 'success';
}/*}}}*/

function login() { /*{{{*/
    elems = document.getElementsByTagName('input');
    a = elems[0];
    b = elems[1];
    if (a.value === '') {
        setText(document.getElementById('error'), 'Enter a username');
        return;
    } else if (b.value === '') {
        setText(document.getElementById('error'), 'Enter a password');
        return;
    }
    setText(document.getElementById('error'), '\u00a0');

    c = CryptoJS.AES.encrypt(b.value, master_key).toString();

    f = element('form');
    f.method = 'POST';
    f.action = 'login.cgi';
    i1 = element('input');
    i1.name = 'a';
    i1.type = 'text';
    i1.value = a.value;
    i2 = element('input');
    i2.name = 'c';
    i2.type = 'password';
    i2.value = c;
    i3 = element('input');
    i3.type = 'hidden';
    i3.name = 't';
    i3.value = jstz.determine().name();
    f.style.display = 'none';
    f.appendChild(i1);
    f.appendChild(i2);
    f.appendChild(i3);
    document.body.appendChild(f);
    f.submit();
} /*}}}*/

function useNightTheme() { /*{{{*/
    theme = document.body.getAttribute('data-night-theme');
    now = new Date();
    return ((theme == 1 && (now.getHours() >= 19 || now.getHours() < 8)) || theme == 2);
} /*}}}*/

function switchToNight() { /*{{{*/
    for (a = 0; a < arguments.length; a++) {arguments[a].className += ' night';}
} /*}}}*/

function trim(s){ /*{{{*/
  return (s || '').replace(/^\s+|\s+$/g, ''); 
}/*}}}*/

function stringFill(x, n) { /*{{{*/
    var s = '';
    for (;;) {
        if (n & 1) {s += x;}
        n >>= 1;
        if (n) {x += x;}
        else {break;}
    }
    return s;
} /*}}}*/

function pad(text, length, fill, side) { /*{{{*/
    if (side == 'f') {
        while (text.length < length) {text = fill + text;}
    } else if (side == 'b') {
        while (text.length < length) {text += fill;}
    }
    return text;
} /*}}}*/

function padTime(text) { /*{{{*/
    return pad(text, 2, '0', 'f');
}/*}}}*/

function isIE() { /*{{{*/
    return (css_browser_selector(navigator.userAgent).search('ie') != -1) ||
            (navigator.userAgent.search('\\) like Gecko') != -1);
} /*}}}*/

function isFirefox() {/*{{{*/
    return (css_browser_selector(navigator.userAgent).search('ff') !== -1);
}/*}}}*/

function flatten(arr) { /*{{{*/
    flat = new Array();
    for (i = 0; i < arr.length; i++) {
        if (arr[i]) {
            arr[i].forEach(function(e) {flat.push(e);});
        }
    }

    return flat;
} /*}}}*/

function deleteAllChildren(elem, removeAll) { /*{{{*/
    if (isIE()) {
        while (elem.childElementCount > 0) {elem.children[0].removeNode(true);}
    } else if (removeAll) {
        while (elem.childNodes.length) {elem.childNodes[0].remove();}
    } else {
        while (elem.childElementCount > 0) {elem.children[0].remove();}
    }
} /*}}}*/

function setText(elem, text) { /*{{{*/
    elem.innerText = text;
    elem.innerHTML = text;
} /*}}}*//*}}}*/

/* Tabs */ /*{{{*/
function addTab(elem, tabElement) { /*{{{*/
    tabElement.className = 'tab ' + elem.id;
    tabLink = element('a');
    tabLink.href = '#';
    tabLink.appendChild(tabElement);
    // If not download tab, add close button/*{{{*/
    if (elem.id != 'dl') {
        x = element('img');
        x.src = 'images/x.png';
        x.alt = 'Close tab';
        x.title = 'Close tab';
        x.setAttribute('data-id', elem.id);
        x.onclick = function() {
            closeTab(this.getAttribute('data-id'));
        };
        setText(tabElement, tabElement.innerText + '\u00a0');
        tabElement.appendChild(x);
    }/*}}}*/

    // If download tab, insert after home/*{{{*/
    if (elem.id == 'dl') {
        t = document.getElementById('tabs');
        t.insertBefore(tabLink, t.children[1]);/*}}}*/
    // Otherwise append/*{{{*/
    } else {
        document.getElementById('tabs').appendChild(tabLink);
    }/*}}}*/
    document.getElementById('main').appendChild(elem);
} /*}}}*/

function closeTab(tabID) { /*{{{*/
    switchTab('home');
    document.getElementById(tabID).remove();
    document.getElementsByClassName(tabID)[0].remove();
} /*}}}*/

function switchTab(tabID) { /*{{{*/
    if (!document.getElementById(tabID)) {return;}

    oldTab = document.getElementsByClassName('selected')[0];
    if (oldTab.id == tabID) {return;}
    oldTab.style.display = 'none';
    oldTab.className = oldTab.className.replace('selected', '').trim();
    newTab = document.getElementById(tabID);
    newTab.style.display = 'inline-block';
    newTab.className = newTab.className + ' selected';
} /*}}}*/ /*}}}*/

/* Notes */ /*{{{*/
function openNotes() { /*{{{*/
    // Create notes panel /*{{{*/
    notes = element('div');
    id = 'notes_' + new Date().getTime();
    notes.id = id;
    notes.className = 'notes';
    notes.style.display = 'none';

    notesList = element('div');
    notesList.className = 'notes_list';
    notes.appendChild(notesList);

    notesEditor = element('div');
    notesEditor.setAttribute('data-note-id', -1);
    notesEditor.className = 'notes_editor';
    notes.appendChild(notesEditor); /*}}}*/

    // Create table to display notes in /*{{{*/
    notesTable = element('table');
    notesTable.className = 'notes';
    if (useNightTheme()) {notesTable.className += ' night';}

    headerRow = element('tr');
    tableTitle = element('th');
    setText(tableTitle, 'Title');
    tableMTime = element('th');
    setText(tableMTime, 'Last Modified');
    headerRow.appendChild(tableTitle);
    headerRow.appendChild(tableMTime);
    notesTable.appendChild(headerRow);

    notesList.appendChild(notesTable); /*}}}*/

    // Create editor pane /*{{{*/
    titleDesc = element('p');
    titleDesc.className = 'form_label';
    setText(titleDesc, 'Title:');

    noteTitle = element('input');
    noteTitle.className = 'note_title';
    noteTitle.type = 'text';
    noteTitle.name = 'title';

    textDesc = element('p');
    textDesc.className = 'form_label';
    setText(textDesc, 'Note:');

    noteText = element('textarea');
    noteText.className = 'note_editor';
    noteText.name = 'text';

    saveButton = element('button');
    saveButton.className = 'left_action';
    setText(saveButton, 'Save');
    saveButton.onclick = function() { /*{{{*/
        editPane = this.parentElement;
        noteID = editPane.getAttribute('data-note-id');
        noteTitle = '';
        noteText = '';
        errorText = 0;
        c = editPane.children;

        for (child= 0; child < c.length; child++) { /*{{{*/
            if (c[child].tagName == 'INPUT') {
                noteTitle = c[child].value;
            } else if (c[child].tagName == 'TEXTAREA') {
                noteText = c[child].value;
            } else if (c[child].className == 'error_text') {
                errorText = c[child];
            }
        } /*}}}*/
        setText(errorText, '');

        if (noteTitle.length === 0) {
            setText(errorText, 'You must enter a title');
            return;
        } else if (noteText.length === 0) {
            setText(errorText, 'You must enter a note');
            return;
        }

        saveNoteReq = createPostReq('notes.cgi', false);

        saveNoteReq.onreadystatechange = function() { /*{{{*/
            if (reqCompleted(this)) {
                status = this.responseText;

                if (status == 'success') {errorText.style.color = 'green';}
                else {errorText.style.color = 'red';}

                switch(status) {
                    case 'success':
                        setText(errorText, 'Saved at ' + getTimeFromString(new Date().toString()));
                        break;
                    case 'none':
                        setText(errorText, 'Update failed - no matching note found!');
                        break;
                    case 'fail':
                        setText(errorText, 'Failed to create new note!');
                        break;
                    case 'extra':
                        setText(errorText, 'Update succeeded, but found multiple matching notes!');
                        break;
                    case 'expired':
                        alert('Session has expired! Please save any modified data locally and reload the page.');
                        break;
                    case 'badid':
                        setText(errorText, 'Update failed - no matching note found!');
                        break;
                    case 'baddata':
                        setText(errorText, 'Update failed - invalid data in title or text field!');
                        break;
                    case 'notmine':
                        alertDisabled();
                        break;
                }
            }
        }; /*}}}*/

        saveNoteReq.send('mode=1&note_id=' + noteID +
                     '&note_title=' + encodeURIComponent(noteTitle) + '&note_text=' + encodeURIComponent(noteText));

        if (saveNoteReq.responseText === 'expired') {return;}

        // Delay update for one second /*{{{*/
        setTimeout(function() {
            updateNoteReq = createPostReq('notes.cgi', true);

            updateNoteReq.onreadystatechange = function() {
                if (reqCompleted(this)) {refreshNotes(this.responseText);}
            };

            updateNoteReq.send('mode=0');
        }, 1000); /*}}}*/
    }; /*}}}*/

    cancelButton = element('button');
    cancelButton.className = 'left_action';
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() { /*{{{*/
        tab = this.parentElement.parentElement.children[0]; /*{{{*/
        table = 0;
        for (child = 0; child < tab.childElementCount; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length !== 0) {
            underlines = document.getElementsByClassName('note_edit');
            for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
        } /*}}}*/

        this.parentElement.setAttribute('data-note-id', -1); /*{{{*/
        c = this.parentElement.children;
        for (child = 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT' || c[child].tagName == 'TEXTAREA') {c[child].value = '';}
            if (c[child].className == 'error_text') {setText(c[child], '');}
        } /*}}}*/
    }; /*}}}*/

    createButton = element('button');
    createButton.className = 'right_action';
    createButton.style.marginRight = '10px';
    setText(createButton, 'Create note');
    createButton.onclick = function() { /*{{{*/
        tab = this.parentElement.parentElement.children[0]; /*{{{*/
        table = 0;
        for (child = 0; child < tab.childElementCount; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length !== 0) {
            underlines = document.getElementsByClassName('note_edit');
            for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
        } /*}}}*/

        this.parentElement.setAttribute('data-note-id', -1); /*{{{*/
        c = this.parentElement.children;
        for (child = 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT' || c[child].tagName == 'TEXTAREA') {c[child].value = '';}
            if (c[child].className == 'error_text') {setText(c[child], '');}
        } /*}}}*/
    }; /*}}}*/

    errorText = element('p');
    errorText.className = 'error_text';

    if (useNightTheme()) {
        switchToNight(notesEditor, titleDesc, noteTitle, textDesc, noteText, saveButton, cancelButton, createButton);
    }

    notesEditor.appendChild(titleDesc);
    notesEditor.appendChild(noteTitle);
    notesEditor.appendChild(element('br'));
    notesEditor.appendChild(textDesc);
    notesEditor.appendChild(noteText);
    notesEditor.appendChild(saveButton);
    notesEditor.appendChild(cancelButton);
    notesEditor.appendChild(errorText);
    notesEditor.appendChild(createButton); /*}}}*/

    // Fetch notes /*{{{*/
    req = createPostReq('notes.cgi', true);

    req.onreadystatechange = function() {
        if (req.readyState == 4 && req.status == 200) {populateNotes(req.responseText, notesTable, notesEditor, 1);}
    };

    req.send('mode=0'); /*}}}*/

    // Create actual note tab /*{{{*/
    noteTab = element('div');
    setText(noteTab, 'Notes');
    noteTab.className = 'tab';
    noteTab.setAttribute('data-id', id);
    noteTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(notes, noteTab);
    switchTab(id); /*}}}*/
} /*}}}*/

function populateNotes(data, notesTable, notesEditor, resize) { /*{{{*/
    if (data == 'noauth') {window.location.reload(true);}

    // Else
    // Get current editor state /*{{{*/
    editorTitleText = '';
    editorNoteText = '';
    for (child = 0; child < notesEditor.childElementCount; child++) {
        editorElem = notesEditor.children[child];
        if (editorElem.tagName == 'INPUT') {editorTitleText = editorElem.value;}
        if (editorElem.tagName == 'TEXTAREA') {editorNoteText = editorElem.value;}
    } /*}}}*/

    notes = JSON.parse(data);
    for (n = 0; n < notes.length; n++) { /*{{{*/
        note = notes[n];
        r = element('tr');
        r.setAttribute('data-note', JSON.stringify(note));

        // Select appropriate note /*{{{*/
        // If no note loaded, but title and text match, this note must have just been created
        selected = 0;
        if (notesEditor.getAttribute('data-note-id') == '-1' &&
            note.title == editorTitleText && note.text == editorNoteText) {
            notesEditor.setAttribute('data-note-id', note.id);
            selected = 1;
        // Otherwise if current note is in editor
        } else if (notesEditor.getAttribute('data-note-id') == note.id) {
            selected = 1;
        } /*}}}*/

        r.onclick = function() { /*{{{*/
            editNote(JSON.parse(this.getAttribute('data-note')), this);

            // Since doing it once doesn't seem to be enough....
            while (document.getElementsByClassName('note_edit').length !== 0) {
                underlines = document.getElementsByClassName('note_edit');
                for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
            }
            underlines = this.getElementsByTagName('u');
            for (u = 0; u < underlines.length; u++) {
                underlines[u].className = 'note_edit';
                if (useNightTheme()) {switchToNight(underlines[u]);}
            }
        }; /*}}}*/
        r.onmouseover = function() { /*{{{*/
            this.style.fontWeight = 'bold';
            this.style.fontStyle = 'italic';
        }; /*}}}*/
        r.onmouseout = function() { /*{{{*/
            this.style.fontWeight = 'normal';
            this.style.fontStyle = 'normal';
        }; /*}}}*/

        title = element('td');
        title.style.paddingRight = '5px';
        title.style.maxWidth = notesTable.clientWidth * 0.3 + 'px';
        title.style.wordWrap = 'break-word';
        titleUnderline = element('u');
        titleUnderline.className = 'note_blank';
        if (selected) {
            titleUnderline.className = 'note_edit';
            if (useNightTheme()) {switchToNight(titleUnderline);}
        }
        titleText = element('span');
        titleText.className = 'normal';
        setText(titleText, note.title);
        titleUnderline.appendChild(titleText);
        title.appendChild(titleUnderline);

        mtime = element('td');
        mtimeUnderline = element('u');
        mtimeUnderline.className = 'note_blank';
        if (selected) {
            mtimeUnderline.className = 'note_edit';
            if (useNightTheme()) {switchToNight(mtimeUnderline);}
        }
        mtimeText = element('span');
        mtimeText.className = 'normal';
        setText(mtimeText, note.mtime.split('\.')[0]);
        mtimeUnderline.appendChild(mtimeText);
        mtime.appendChild(mtimeUnderline);
        a = element('a');
        a.href = '#';
        a.style.cssFloat = 'right';
        a.style.paddingRight = '5px';
        i = element('img');
        i.src = 'images/x.png';
        i.alt = 'Delete note';
        i.title = 'Delete note';
        a.appendChild(i);
        a.setAttribute('data-note-id', note.id);
        a.setAttribute('data-note-title', note.title);
        a.onclick = function() { /*{{{*/
            confirmDelete = confirm('Are you sure you want to delete note \'' + this.getAttribute('data-note-title') + '\'?');
            if (!confirmDelete) {return;}
            deletedNoteID = this.getAttribute('data-note-id');
            deleteNoteReq = createPostReq('notes.cgi', true);

            deleteNoteReq.onreadystatechange = function() {
                if (reqCompleted(this)) {
                    refreshNotesReq = createPostReq('notes.cgi', true);

                    refreshNotesReq.onreadystatechange = function() { /*{{{*/
                        if (reqCompleted(this)) {
                            if (notesEditor.getAttribute('data-note-id') == deletedNoteID) {
                                notesEditor.setAttribute('data-note-id', -1);
                                for (child = 0; child < notesEditor.childElementCount; child++) {
                                    elem = notesEditor.children[child];
                                    if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
                                }
                            }
                            refreshNotes(this.responseText);
                        }
                    }; /*}}}*/

                    refreshNotesReq.send('mode=0');
                }
            };

            deleteNoteReq.open('POST', 'notes.cgi', true);
            deleteNoteReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            deleteNoteReq.send('mode=2&note_id=' + this.getAttribute('data-note-id'));
        } /*}}}*/
        mtime.appendChild(a);

        if (useNightTheme()) {
            switchToNight(titleText, mtimeText);
        }

        r.appendChild(title);
        r.appendChild(mtime);

        notesTable.appendChild(r);
    } /*}}}*/

    // Resize notes text to fill height /*{{{*/
    if (resize) {
        noteText = 0;
        c = notesEditor.children;
        for (child= 0; child < c.length; child++) {
            if (c[child].tagName == 'TEXTAREA') {
                noteText = c[child];
                break;
            }
        }
        noteText.style.height = notesEditor.offsetHeight - noteText.offsetTop - 30 + 'px';

        titleTD = notesTable.children[0].children[0];
        titleTD.style.width = titleTD.offsetWidth + 20 + 'px';
    } /*}}}*/
} /*}}}*/

function editNote(note, row) { /*{{{*/
    notePanel = row.parentElement.parentElement.parentElement;
    panes = notePanel.children;
    editPane = 0;
    for (pane = 0; pane < panes.length; pane++) { /*{{{*/
        if (panes[pane].className.search('notes_editor') != -1) {
            editPane = panes[pane];
            break;
        }
    } /*}}}*/
    editPane.setAttribute('data-note-id', note.id);
    editElems = editPane.children;
    for (elem = 0; elem < editElems.length; elem++) { /*{{{*/
        if (editElems[elem].tagName == 'INPUT') {editElems[elem].value = note.title;}
        if (editElems[elem].tagName == 'TEXTAREA') {editElems[elem].value = note.text;}
        if (editElems[elem].className == 'error_text') {setText(editElems[elem], '');}
    } /*}}}*/
} /*}}}*/

function refreshNotes(notes) { /*{{{*/
    notesPanes = document.getElementsByClassName('notes');
    for (pane = 0; pane < notesPanes.length; pane++) {
        if (notesPanes[pane].tagName != 'DIV') {continue;}

        notePane = notesPanes[pane];
        noteTable = 0;
        noteEditor = 0;
        // Get note table and note editor /*{{{*/
        // and clear out old entries
        for (child = 0; child < notePane.childElementCount; child++) {
            elem = notePane.children[child];
            if (elem.className.search('notes_editor') != -1) {noteEditor = elem;}
            if (elem.className.search('notes_list') != -1) {
                noteTable = elem.children[0];

                while (noteTable.childElementCount > 1) {
                    row = noteTable.children[1];
                    row.remove();
                }
            }
        } /*}}}*/

        // If this pane wasn't selected, clear out its edit panel /*{{{*/
        if (noteTable.parentElement.parentElement.className.search('selected') == -1) {
            noteEditor.setAttribute('data-note-id', -1);
            for (child = 0; child < noteEditor.childElementCount; child++) {
                elem = noteEditor.children[child];
                if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
            }
        } /*}}}*/

        populateNotes(notes, noteTable, noteEditor, 0);
    }
} /*}}}*/ /*}}}*/

/* Tasks */ /*{{{*/
/* Generic task functions *//*{{{*/
function switchDeadlineTimezone(d) { /*{{{*/
    utc = 0;
    if (d.toString().search('\\\+') != -1) {
        utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    } else {
        utc = d.getTime() - (d.getTimezoneOffset() * 60000);
    }
    return new Date(utc);
} /*}}}*/

function deadlineToDate(deadline) { /*{{{*/
    deadline = deadline.replace('-', '/');
    deadline = deadline.replace('-', '/');
    deadline = deadline.substr(0, deadline.length - 3);
    d = new Date(deadline);
    return d;
} /*}}}*/

function getTimeFromString(dateString) { /*{{{*/
    time = dateString.split(' ')[4].split(':')
    return padTime(time[0]) + ':' + padTime(time[1])
} /*}}}*/

function makeBlankTask(project) { /*{{{*/
    newTask = new Object();
    newTask.id = -1;
    newTask.name = 'New task';
    newTask.description = '';
    newTask.priority = -1;
    newTask.project = project;
    newTask.deadline = null;
    newTask.is_urgent = true;

    return newTask;
} /*}}}*//*}}}*/

/* Data structure functions *//*{{{*/
function fetchTaskData() { /*{{{*/
    getTasksReq = createPostReq('tasks.cgi', false);
    getTasksReq.send('mode=0');
    if (getTasksReq.responseText === 'noauth') {
        alertNoAuth();
    } else if (getTasksReq.responseText === 'Bad request!') {
        alert('Invalid request! Please copy any unsaved changes then refresh the page.');
    } else if (getTasksReq.responseText == 'notmine') {
        alertDisabled();
    }
    rootProjects.length = 0;
    subProjects.length = 0;
    data = JSON.parse(getTasksReq.responseText);
    projects = data[0];
    parseProjects();
    tasks = data[1];
    sortedTasks = parseTasks(tasks);
} /*}}}*/

function parseTasks(tasks) { /*{{{*/
    urgent = new Array();
    other = new Array();
    normal = new Array();
    for (taskNum = 0; taskNum < tasks.length; taskNum++) {
        task = tasks[taskNum];
        if (task.is_urgent) { /*{{{*/
            if (!urgent[task.project] || urgent[task.project].constructor.name !== 'Array') {
                urgent[task.project] = new Array();
            }
            urgent[task.project].push(task); /*}}}*/
        } else if (task.is_other) { /*{{{*/
            if (!other[task.project] || other[task.project].constructor.name !== 'Array') {
                other[task.project] = new Array();
            }
            other[task.project].push(task); /*}}}*/
        } else { /*{{{*/
            if (!normal[task.project] || normal[task.project].constructor.name !== 'Array') {
                normal[task.project] = new Array();
            }
            normal[task.project].push(task);
        } /*}}}*/
    }

    return [urgent, other, normal];
} /*}}}*/

function getTasksInProject(projectID) { /*{{{*/
    projectTasks = [[], [], []];
    projectIDs = [projectID];
    if (subProjects[projectID]) {projectIDs = getSubprojects(projectID, []);}

    // For each project /*{{{*/
    for (p = 0; p < projectIDs.length; p++) {
        // For each kind of task
        for (taskGroup = 0; taskGroup < sortedTasks.length; taskGroup++) {
            // If tasks exist, add them to the list
            if (!sortedTasks[taskGroup][projectIDs[p]]) {continue;}
            sortedTasks[taskGroup][projectIDs[p]].map(function(t) {projectTasks[taskGroup].push(t);});
        }
    } /*}}}*/

    return projectTasks;
} /*}}}*/

function sortTasksByPriority(t1, t2) { /*{{{*/
    if (t1.priority == t2.priority) {
        return (t1.name > t2.name) ? 1 : -1;
    }
    return (t1.priority > t2.priority) ? 1 : -1;
} /*}}}*/

function parseProjects() { /*{{{*/
    defaultProject = -1;
    for (project = 0; project < projects.length; project++) { /*{{{*/
        p = projects[project];
        projectsByID[p.id] = p;
        projectHierarchy[p.id] = p.parent;
        if (p.name == 'Default') {defaultProject = p; continue;}
        if (!p.parent) {
            rootProjects.push(p);
            continue;
        } else if (!subProjects[p.parent]) {
            subProjects[p.parent] = new Array();
        }
        subProjects[p.parent].push(p);
    } /*}}}*/
    rootProjects.sort(function(p1, p2) {return (p1.name > p2.name);});
    rootProjects.splice(0, 0, defaultProject);
} /*}}}*/

function getSubprojects(projectID, projectIDs) { /*{{{*/
    projectIDs.push(projectID);
    if (subProjects[projectID]) {
        for (subp = 0; subp < subProjects[projectID].length; subp++) {
            projectIDs = getSubprojects(subProjects[projectID][subp].id, projectIDs);
        }
    }

    return projectIDs;
} /*}}}*//*}}}*/

/* DOM Manipulation */
function openTasks() { /*{{{*/
    id = 'tasks_' + new Date().getTime();
    taskPanel = element('div');
    taskPanel.className = 'tasks';
    taskPanel.id = id;

    // Create panel skeleton /*{{{*/
    // Section headers /*{{{*/
    projectsPanel = element('div');
    projectsPanel.className = 'project_panel';
    projectsPanel.setAttribute('data-project-id', -1);

    projectsList = element('div');
    projectsList.className = 'project_list'; /*}}}*/

    // Create new project input/button /*{{{*/
    newProject = element('span');
    newProjectName = element('input');
    newProjectName.className = 'new_project';
    newProjectName.value = 'Enter new project name';
    newProjectName.onfocus = function() { /*{{{*/
        if (this.value === 'Enter new project name') {this.value = '';}
    }; /*}}}*/
    newProjectName.onblur = function() { /*{{{*/
        if (this.value === '') {this.value = 'Enter new project name';}
    }; /*}}}*/
    saveNewProject = element('a');
    saveNewProject.className = 'save_project';
    saveNewProject.href = '#';
    saveNewProject.onclick = function() { /*{{{*/
        list = this.parentElement.parentElement.getElementsByClassName('project_list')[0];
        nameElem = this.previousSibling;
        if (name === 'Enter new project name') {return;}

        saveProjReq = createPostReq('tasks.cgi', true);

        saveProjReq.onreadystatechange = function() { /*{{{*/
            if (reqCompleted(this)) {
                switch(this.responseText) {
                    case 'success':
                        nameElem.value = 'Enter new project name';

                        fetchTaskData();
                        populateProjects(list); /*{{{*/ /*}}}*/

                        break;
                    case 'notmine':
                        alertDisabled();
                        break;
                    default:
                        alert('Failed to create project!');
                        break;
                }
            }
        }; /*}}}*/

        saveProjReq.send('mode=1&name=' + nameElem.value + '&parent=' + projectsPanel.getAttribute('data-project-id'));
    }; /*}}}*/
    setText(saveNewProject, '+');
    newProject.appendChild(newProjectName);
    newProject.appendChild(saveNewProject); /*}}}*/

    // Upcoming panel /*{{{*/
    upcoming = element('div');
    upcoming.className = 'task_view';
    upcoming.setAttribute('project_level', 0);

    upcomingU = element('u');
    upcomingU.className = 'note_edit';
    upcomingP = element('p');
    upcomingP.className = 'normal_section_header';
    setText(upcomingP, 'Upcoming tasks');
    upcomingP.style.marginTop = '5px';
    upcomingU.appendChild(upcomingP);

    if (useNightTheme()) {
        switchToNight(projectsPanel, newProjectName, upcoming, upcomingU, upcomingP);
    }

    projectsPanel.appendChild(projectsList);
    projectsPanel.appendChild(newProject);

    upcoming.appendChild(upcomingU);
    taskPanel.appendChild(projectsPanel);
    taskPanel.appendChild(upcoming); /*}}}*/

    fetchTaskData();
    populateProjects(projectsList);
    populateUpcoming(upcoming); /*}}}*/

    // Add tab and panel /*{{{*/
    taskTab = element('div');
    setText(taskTab, 'Task List');
    taskTab.className = 'tab';
    taskTab.setAttribute('data-id', id);
    taskTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(taskPanel, taskTab);
    switchTab(id); /*}}}*/

    // Position the new project elements /*{{{*/
    newProject.style.position = 'absolute';
    newProject.style.top = projectsPanel.offsetTop + projectsPanel.offsetHeight - newProject.offsetHeight - 5 + 'px';
    newProject.style.width = projectsPanel.offsetWidth - 5 + 'px';
    newProjectName.style.width = newProject.offsetWidth - saveNewProject.offsetWidth - 10 + 'px';
    saveNewProject.style.left = newProjectName.offsetLeft + newProjectName.offsetWidth + 3 + 'px';
    saveNewProject.style.top = newProjectName.offsetTop + (0.5 * newProjectName.offsetHeight - (0.5 * saveNewProject.offsetHeight)) + 1 + 'px'; /*}}}*/

    // Check if task wraps by comparing offsettops through DOM /*{{{*/
    spans = upcoming.getElementsByTagName('span');
    // For each set of tasks (urgent, normal, other)
    for (s = 0; s < spans.length; s++) {
        span = spans[s];
        // For each task/header in them /*{{{*/
        for (pNum = 0; pNum < span.childElementCount; pNum++) {
            p = span.children[pNum];
            // Eliminate headers
            if (p.className.search('normal_text') === -1) {continue;}
            offset = p.children[0].offsetTop;
            breakLine = 0;
            // For each of their children /*{{{*/
            for (cNum = 1; cNum < p.childElementCount; cNum++) {
                c = p.children[cNum];
                childBreakFound = 0
                // If it has children (some do, some don't) /*{{{*/
                if (c.childElementCount) {
                    for (c2Num = 0; c2Num < c.childElementCount; c2Num++) {
                        c2 = c.children[c2Num];
                        if (c2.offsetTop > offset) {
                            childBreakFound = 1;
                            break;
                        }
                    }
                } /*}}}*/

                if (childBreakFound || c.offsetTop > offset) { /*{{{*/
                    breakLine = 1;
                    break;
                } /*}}}*/
            } /*}}}*/

            if (breakLine) { /*{{{*/
                if (span.children[pNum + 1]) {
                    span.insertBefore(element('br'), span.children[pNum + 1]);
                } else {
                    span.appendChild(element('br'));
                }
            } /*}}}*/
        } /*}}}*/
    } /*}}}*/
} /*}}}*/

function populateProjects(projectsList) { /*{{{*/
    deleteAllChildren(projectsList);

    // Create project list headers /*{{{*/
    projectsListHeader = element('span');
    upcomingTitle = element('p');
    upcomingTitle.className = 'normal_section_header';
    upcomingTitle.style.marginTop = '5px';
    upcomingTitle.style.marginBottom = '10px';
    upcomingLink = element('a');
    upcomingLink.className = 'normal_section_header';
    upcomingLink.href = '#';
    upcomingLink.onclick = function() { /*{{{*/
        this.parentElement.parentElement.parentElement.parentElement.setAttribute('data-project-id', -1);
        // First three arguments don't need to be stored, since if they are modified
        // it will be with updated information
        taskView = this.parentElement.parentElement.parentElement.parentElement.parentElement.children[1];
        fetchTaskData();

        populateUpcoming(taskView);

        // Check if task wraps by comparing offsettops through DOM
        spans = taskView.getElementsByTagName('span');
        // For each set of tasks (urgent, normal, other)
        for (s = 0; s < spans.length; s++) {
            span = spans[s];
            // For each task/header in them /*{{{*/
            for (pNum = 0; pNum < span.childElementCount; pNum++) {
                p = span.children[pNum];
                // Eliminate headers
                if (p.className.search('normal_text') === -1) {continue;}
                offset = p.children[0].offsetTop;
                breakLine = 0;
                // For each of their children /*{{{*/
                for (cNum = 1; cNum < p.childElementCount; cNum++) {
                    c = p.children[cNum];
                    childBreakFound = 0
                    // If it has children (some do, some don't) /*{{{*/
                    if (c.childElementCount) {
                        for (c2Num = 0; c2Num < c.childElementCount; c2Num++) {
                            c2 = c.children[c2Num];
                            if (c2.offsetTop > offset) {
                                childBreakFound = 1;
                                break;
                            }
                        }
                    } /*}}}*/

                    if (childBreakFound || c.offsetTop > offset) {
                        breakLine = 1;
                        break;
                    }
                } /*}}}*/

                if (breakLine) { /*{{{*/
                    if (span.children[pNum + 1]) {
                        span.insertBefore(element('br'), span.children[pNum + 1]);
                    } else {
                        span.appendChild(element('br'));
                    }
                } /*}}}*/
            } /*}}}*/
        }
    } /*}}}*/
    setText(upcomingLink, 'Overview');
    upcomingTitle.appendChild(upcomingLink);

    projectsTitle = element('p');
    projectsTitle.className = 'normal_section_header';
    projectsTitle.style.marginTop = '5px';
    projectsTitle.style.marginBottom = '10px';
    setText(projectsTitle, 'Projects:');

    if (useNightTheme()) {switchToNight(upcomingTitle, upcomingLink, projectsTitle);}

    projectsListHeader.appendChild(upcomingTitle);
    projectsListHeader.appendChild(projectsTitle);
    projectsList.appendChild(projectsListHeader); /*}}}*/

    // Create project list
    for (project = 0; project < rootProjects.length; project++) {
        currentRoot = rootProjects[project];
        addProject(projectsList, currentRoot, 0);
    }
} /*}}}*/

function addProject(parent, project, level) { /*{{{*/
    /* Create and add this project to the list
       In state preservation, level == 0 means root project
       Since some conditions account for the level == 0 part,
       then project.id doesn't need to be checked since what actually matters
       is that its parent is expanded, not itself
       The parts that set the '+'+ or '-' text do not care if the project
       is a root or sub project, and therefore the ID must be checked
       in addition to the parent
    */

    // Expand project button /*{{{*/
    expandProject = element('a');
    // Only change color if we are expanded
    if (expanded[project.id] && subProjects[project.id] && subProjects[project.id].length) {
        expandProject.className = 'close_project';
        expandProject.setAttribute('data-expanded', 1);
    } else {
        expandProject.className = 'open_project';
        expandProject.setAttribute('data-expanded', 0);
    }
    expandProject.setAttribute('data-project-id', project.id);
    expandProject.setAttribute('data-level', level);
    setText(expandProject, stringFill('\u00a0', 3 * level) + '~'); /*}}}*/

    // Open project text /*{{{*/
    openProjectLink = element('a');
    openProjectLink.href = '#';
    openProjectLink.style.textDecoration = 'none';
    openProjectLink.setAttribute('data-project', JSON.stringify(project));
    openProjectLink.onclick = function() { /*{{{*/
        taskView = this.parentElement.parentElement.parentElement.children[1];
        openProj = JSON.parse(this.getAttribute('data-project'));
        openProject(taskView, openProj);
    }; /*}}}*/
    projectName = element('p');
    projectName.className = 'project_name';
    setText(projectName, '\u00a0' + project.name);
    openProjectLink.appendChild(projectName); /*}}}*/

    // Delete project button /*{{{*/
    removeProjectLink = element('a');
    removeProjectLink.className = 'blank';
    removeProjectLink.href = '#';
    removeProjectLink.setAttribute('data-project-id', project.id);
    removeProjectLink.setAttribute('data-project-name', project.name);
    removeProjectLink.onclick = function() { /*{{{*/
        taskView = this.parentElement.parentElement.parentElement.children[1];
        deleteProject(this.getAttribute('data-project-id'), 'tree', taskView);
    }; /*}}}*/
    removeProjectImg = element('img');
    removeProjectImg.src = 'images/x.png';
    removeProjectImg.alt = 'Remove project';
    removeProjectImg.title = 'Remove project';
    removeProjectLink.appendChild(document.createTextNode('\u00a0\u00a0'));
    removeProjectLink.appendChild(removeProjectImg);

    if (useNightTheme()) {switchToNight(projectName);}
    if (level !== 0 && !expanded[project.parent]) {
        expandProject.style.display = 'none';
        openProjectLink.style.display = 'none';
        removeProjectLink.style.display = 'none';
    }

    parent.appendChild(expandProject);
    parent.appendChild(openProjectLink);
    parent.appendChild(removeProjectLink);
    if (level === 0 || expanded[project.parent] == 1) {parent.appendChild(element('br'));} /*}}}*/

    // If there are actually projects to expand /*{{{*/
    if (subProjects[project.id] && subProjects[project.id].length) {
        if (expanded[project.id] && subProjects[project.id].length) {
            setText(expandProject, stringFill('\u00a0', 3 * level) + '-' + '\u00a0');
        } else if (subProjects[project.id].length) {
            setText(expandProject, stringFill('\u00a0', 3 * level) + '+');
        }
        expandProject.href = '#';
        expandProject.onclick = function() { /*{{{*/
            nextSibling = this.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling;
            // Collapse /*{{{*/
            if (this.getAttribute('data-expanded') == 1) {
                this.setAttribute('data-expanded', 0);
                this.className = 'open_project';
                if (subProjects[this.getAttribute('data-project-id')].length) {
                    setText(this, stringFill('\u00a0', 3 * this.getAttribute('data-level')) + '+');
                }
                expanded[this.getAttribute('data-project-id')] = 0;
                // Make all sub-nodes invisible
                while (!nextSibling.getAttribute('data-level') || nextSibling.getAttribute('data-level') > this.getAttribute('data-level')) {
                    // If a br, remove it and continue
                    if (nextSibling.tagName == 'BR') {
                        nextSibling = nextSibling.nextElementSibling;
                        nextSibling.previousElementSibling.remove();
                        continue;
                    }
                    nextSibling.style.display = 'none';
                    if (nextSibling.className === 'close_project') {
                        expanded[nextSibling.getAttribute('data-project-id')] = 0;
                        nextSibling.className = 'open_project';
                        if (subProjects[nextSibling.getAttribute('data-project-id')].length) {
                            setText(nextSibling, stringFill('\u00a0', 3 * nextSibling.getAttribute('data-level')) + '+');
                        }
                        nextSibling.setAttribute('data-expanded', 0);
                    }
                    nextSibling = nextSibling.nextElementSibling;
                } /*}}}*/
            // Expand /*{{{*/
            } else {
                this.setAttribute('data-expanded', 1);
                expanded[this.getAttribute('data-project-id')] = 1;
                if (subProjects[this.getAttribute('data-project-id')].length) {
                    this.className = 'close_project';
                    numSpaces = 3 * this.getAttribute('data-level');
                    setText(this, stringFill('\u00a0', numSpaces) + '-' + '\u00a0');
                }
                count = 0;
                while (nextSibling.getAttribute('data-level') !== this.getAttribute('data-level')) {
                    nextLevel = nextSibling.getAttribute('data-level');
                    // Make sure that we are still only one level deeper than the expanded element /*{{{*/
                    if (nextLevel) {
                        while ((!nextLevel) ||
                            nextLevel.toString() !== (parseInt(this.getAttribute('data-level'), 10) + 1).toString()) {
                            if (nextLevel && nextLevel.toString() === this.getAttribute('data-level')) {break;}
                            nextSibling = nextSibling.nextElementSibling;
                            nextLevel = nextSibling.getAttribute('data-level');
                        }
                    } /*}}}*/
                    if (nextSibling.getAttribute('data-level') === this.getAttribute('data-level')) {break;}
                    nextSibling.style.display = 'inline';
                    count++;
                    // If at end of elements for this project, add new line /*{{{*/
                    if (count == 3) {
                        count = 0;
                        parent.insertBefore(element('br'), nextSibling.nextElementSibling);
                        nextSibling = nextSibling.nextElementSibling;
                    } /*}}}*/
                    nextSibling = nextSibling.nextElementSibling;
                }
            } /*}}}*/
        }; /*}}}*/

        for (subp = 0; subp < subProjects[project.id].length; subp++) { /*{{{*/
            parent.setAttribute('data-current-sub-' + level, subp);
            subpr = subProjects[project.id][subp];
            addProject(parent, subpr, level + 1, projectsByID, projectHierarchy, subProjects, tasks);
            subp = parent.getAttribute('data-current-sub-' + level);
        } /*}}}*/
    } /*}}}*/
} /*}}}*/

function populateUpcoming(taskView) { /*{{{*/
    deleteAllChildren(taskView, 1);

    upcomingP = element('p');
    upcomingP.className = 'normal_section_header';
    setText(upcomingP, 'Upcoming tasks');
    upcomingP.style.marginTop = '0px';

    if (useNightTheme()) {switchToNight(upcomingP);}

    taskView.appendChild(upcomingP);

    // Add new task button /*{{{*/
    newTaskP = element('p');
    newTaskP.style.display = 'inline';
    newTaskP.style.cssFloat = 'right';
    newTaskP.style.marginBottom = '2px';
    newTaskButton = element('button');
    newTaskButton.onclick = function() {
        openTask(makeBlankTask('-1'), taskView, 'overview');
    }
    setText(newTaskButton, 'Create task');
    newTaskP.appendChild(newTaskButton);

    if (isFirefox()) {newTaskP.style.paddingRight = '15px';}
    if (useNightTheme()) {switchToNight(newTaskButton);}

    taskView.appendChild(newTaskP); /*}}}*/

    // Tasks sorted by deadline, priority, then name /*{{{*/
    // sortedTask is two-dimensional array, but project is
    // inconsequential for the task view, so flatten them
    urgent = flatten(sortedTasks[0]);
    other = flatten(sortedTasks[1]);
    normal = flatten(sortedTasks[2]);
    urgent.sort(sortTasksByPriority);
    other.sort(sortTasksByPriority); /*}}}*/

    // Create HTML elements from tasks /*{{{*/
    out = tasksToHTML(urgent, normal, other, 1);
    urgentHeader = out[0];
    urgentHR = out[1];
    urgentTasks = out[2];
    normalTasks = out[3];
    otherHeader = out[4];
    otherHR = out[5];
    otherTasks = out[6]; /*}}}*/

    addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks);
} /*}}}*/

function openTask(task, taskView, redirectView) { /*{{{*/
    deleteAllChildren(taskView, 1);
    taskView.parentElement.children[0].setAttribute('data-project-id', task.project);
    c = 'black';
    if (useNightTheme()) {c = 'silver';}

    // If task has a project, display path /*{{{*/
    if (task.project != -1) {
        // Display task path
        projLinks = createProjectLinks(task.project, c, 1, 1);
        addProjectLinks(projLinks, c, taskView, true)
    } /*}}}*/

    // Add this task /*{{{*/
    if (task.project !== -1) {
        tmpP = element('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = c;
        setText(tmpP, '\u00a0:\u00a0');
        tmpP.style.fontWeight = 'bold';
        tmpP.style.fontSize = '115%';
        taskView.appendChild(tmpP);
    }

    tmpP = element('p');
    tmpP.style.display = 'inline';
    tmpP.style.color = c;
    setText(tmpP, task.name);
    tmpP.style.whiteSpace = 'nowrap';
    tmpP.style.fontWeight = 'bold';
    tmpP.style.fontSize = '115%';
    taskView.appendChild(tmpP); /*}}}*/

    // If task path wraps, indent each new line /*{{{*/
    lastOffset = taskView.children[1].offsetTop;
    for (p = 2; p < taskView.childElementCount; p++) {
        e = taskView.children[p];
        if (e.offsetTop > lastOffset) {
            lastOffset = e.offsetTop;
            taskView.insertBefore(document.createTextNode(stringFill('\u00a0', 4)), e);
        }
    } /*}}}*/

    // Delete task button, if not new /*{{{*/
    if (task.id != -1) {
        deleteTaskElem = element('p');
        deleteTaskElem.style.display = 'inline';
        setText(deleteTaskElem, '\u00a0\u00a0');
        deleteTaskLink = element('a');
        deleteTaskLink.href = '#';
        deleteTaskLink.setAttribute('data-task', JSON.stringify(task));
        deleteTaskLink.onclick = function() { /*{{{*/
            t = JSON.parse(this.getAttribute('data-task'));
            conf = confirm('Are you sure you want to delete task \'' + t.name + '\'?');
            if (conf) {deleteTask(this.getAttribute('data-task'), taskView, false);}
        }; /*}}}*/
        deleteTaskImg = element('img');
        deleteTaskImg.src = 'images/x.png';
        deleteTaskImg.title = 'Delete task';
        deleteTaskImg.alt = 'Delete task';
        deleteTaskLink.appendChild(deleteTaskImg);
        deleteTaskElem.appendChild(deleteTaskLink);
        taskView.appendChild(deleteTaskElem);
    } /*}}}*/

    taskView.appendChild(element('br'));
    taskView.appendChild(element('br'));

    // Create task edit GUI /*{{{*/
    // Project /*{{{*/
    projectSelect = projectsToSelect(task.project);
    projectSelect.onchange = function() {
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-project', this.value);
        saveButton.setAttribute('data-project', JSON.stringify(projectsByID[this.value]));
    }
    taskView.appendChild(projectSelect); /*}}}*/

    // Title /*{{{*/
    titleLabel = element('p');
    titleLabel.className = 'normal_text form_label';
    setText(titleLabel, 'Task\u00a0name:\u00a0')
    titleInput = element('input');
    titleInput.style.width = '75%';
    titleInput.value = task.name; /*}}}*/

    // Description /*{{{*/
    descLabel = element('p');
    descLabel.className = 'normal_text form_label';
    setText(descLabel, 'Task\u00a0Description:');
    descInput = element('textarea');
    descInput.style.width = '90%';
    descInput.style.height = '30%';
    descInput.value = task.description; /*}}}*/

    // Priority /*{{{*/
    priLabel = element('p');
    priLabel.className = 'normal_text form_label';
    priLabel.style.display = 'inline';
    setText(priLabel, 'Task\u00a0Priority\u00a0(High to low):\u00a0\u00a0');

    priInput = element('select');
    for (o = 1; o <= 12; o++) {
        opt = element('option');
        setText(opt, o);
        opt.value = o;
        if (o == task.priority) {opt.selected = true;}
        priInput.appendChild(opt);
        if (useNightTheme()) {switchToNight(opt);}
    } /*}}}*/

    // Deadline /*{{{*/
    // Elements 
    deadlineGroup = element('fieldset');
    deadlineGroup.style.width = '92%';
    deadlineLabel = element('legend');
    setText(deadlineLabel, 'Deadline');
    urgentRadio = element('input');
    urgentRadio.name = 'deadline';
    urgentRadio.type = 'radio';
    urgentRadio.value = 'u';
    urgentRadio.onclick = function() { /*{{{*/
        e = this;
        for (i = 0; i < 6; i++) {
            e = e.nextElementSibling;
        }

        e.readOnly = true;
    }; /*}}}*/
    urgentLabel = element('p');
    urgentLabel.className = 'normal_text';
    urgentLabel.style.display = 'inline';
    setText(urgentLabel, 'ASAP');
    otherRadio = element('input');
    otherRadio.name = 'deadline';
    otherRadio.type = 'radio';
    otherRadio.value = 's';
    otherRadio.onclick = function() { /*{{{*/
        e = this;
        for (i = 0; i < 4; i++) {
            e = e.nextElementSibling;
        }

        e.readOnly = true;
    }; /*}}}*/
    otherLabel = element('p');
    otherLabel.className = 'normal_text';
    otherLabel.style.display = 'inline';
    setText(otherLabel, 'No deadline');
    dateRadio = element('input');
    dateRadio.name = 'deadline';
    dateRadio.type = 'radio';
    dateRadio.value = 'd';
    dateRadio.onclick = function() { /*{{{*/
        this.nextElementSibling.nextElementSibling.disabled = false;
    }; /*}}}*/
    dateLabel = element('p');
    dateLabel.className = 'normal_text';
    dateLabel.style.display = 'inline';
    setText(dateLabel, 'Date\u00a0');
    dateInput = createDateInput();

    // Add defaults to deadline fields /*{{{*/
    if (task.is_urgent) {urgentRadio.defaultChecked = true; dateInput.readOnly = true;}
    else if (task.is_other) {otherRadio.defaultChecked = true; dateInput.readOnly = true;}
    else {
        dateRadio.defaultChecked = true;
        d = deadlineToDate(task.deadline);
        time = getTimeFromString(d.toString());
        deadline = d.getFullYear() + '-' +
                   pad((d.getUTCMonth() + 1).toString(), 2, '0', 'f') + '-' +
                   pad(d.getUTCDate().toString(), 2, '0', 'f') +
                   'T' + time;
        dateInput.value = deadline;
    } /*}}}*/

    deadlineGroup.appendChild(deadlineLabel);
    deadlineGroup.appendChild(urgentRadio);
    deadlineGroup.appendChild(urgentLabel);
    deadlineGroup.appendChild(otherRadio);
    deadlineGroup.appendChild(otherLabel);
    deadlineGroup.appendChild(dateRadio);
    deadlineGroup.appendChild(dateLabel);
    deadlineGroup.appendChild(dateInput);

    if (useNightTheme()) {
        switchToNight(titleLabel, titleInput, descLabel, descInput, priLabel, priInput,
            deadlineLabel, urgentLabel, otherLabel, dateLabel, dateInput);
    } /*}}}*/

    // Create save and cancel buttons /*{{{*/
    errorText = element('p');
    errorText.className = 'error';
    errorText.style.display = 'inline';
    setText(errorText, '\u00a0');
    saveButton = element('button');
    saveButton.setAttribute('data-task-id', task.id);
    saveButton.setAttribute('data-redirect', redirectView);
    if (task.project == -1) {
        saveButton.setAttribute('data-task-project', projectSelect.value);
        saveButton.setAttribute('data-project', JSON.stringify(projectsByID[projectSelect.value]));
    } else {
        saveButton.setAttribute('data-task-project', task.project);
        saveButton.setAttribute('data-project', JSON.stringify(projectsByID[task.project]));
    }
    saveButton.setAttribute('data-task-name', task.name);
    saveButton.setAttribute('data-task-desc', task.description);
    if (task.priority == -1) {
        saveButton.setAttribute('data-task-priority', priInput.value);
    } else {
        saveButton.setAttribute('data-task-priority', task.priority);
    }
    d = 0;
    if (task.is_urgent) {d = 'u';}
    else if (task.is_other) {d = 's';}
    else {d = dateInput.value;}
    saveButton.setAttribute('data-task-deadline', d);
    setText(saveButton, 'Save');
    saveButton.onclick = function() { /*{{{*/
        errorText = this.nextElementSibling.nextElementSibling;
        sB = this;

        saveTaskReq = createPostReq('tasks.cgi', true);

        saveTaskReq.onreadystatechange = function() { /*{{{*/
            if (reqCompleted(this)) {
                if (this.responseText === 'success') {
                    errorText.style.color = 'green';
                    setText(errorText, 'Saved at ' + getTimeFromString(new Date().toString()));

                    fetchTaskData();
                    if (sB.getAttribute('data-redirect') == 'project') {
                        openProject(taskView, JSON.parse(sB.getAttribute('data-project')));
                    } else {
                        populateUpcoming(taskView);
                    }
                } else if (this.responseText == 'notmine') {
                    alertDisabled();
                } else {
                    errorText.style.color = 'red';
                    setText(errorText, 'Save failed - ' + this.responseText);
                }
            }
        }; /*}}}*/

        saveTaskReq.send('mode=2&id=' + this.getAttribute('data-task-id') + '&n=' + this.getAttribute('data-task-name') +
                         '&pj=' + this.getAttribute('data-task-project') + '&ds=' + this.getAttribute('data-task-desc') +
                         '&p=' + this.getAttribute('data-task-priority') + '&d=' + this.getAttribute('data-task-deadline'));
    }; /*}}}*/

    cancelButton = element('button');
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() { /*{{{*/
        if (task.project != -1) {
            openProject(taskView, projectsByID[task.project]);
        } else {
            populateUpcoming(taskView);
        }
    } /*}}}*/

    if (useNightTheme()) {
        switchToNight(saveButton, cancelButton);
    } /*}}}*/

    // Text handlers /*{{{*/
    titleInput.onchange = function() { /*{{{*/
        e = this;
        while (!(e.style.fontWeight === 'bold')) {
            e = e.previousElementSibling;
        }
        setText(e, this.value);
        if (this.value !== '') {
            saveButton = this.parentElement.getElementsByTagName('button')[0];
            saveButton.setAttribute('data-task-name', this.value);
            if (errorText.innerText === 'Name cannot be blank') {
                setText(errorText, '\u00a0');
                saveButton.disabled = false;
            }
        } else {
            errorText = this.parentElement.getElementsByClassName('error')[0];
            errorText.style.color = 'red';
            setText(errorText, 'Name cannot be blank');
            saveButton.disabled = true;
        }
    } /*}}}*/

    descInput.onchange = function() { /*{{{*/
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-desc', this.value);
    } /*}}}*/

    priInput.onchange = function() { /*{{{*/
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-priority', this.value);
    } /*}}}*/

    urgentRadio.onchange = function() { /*{{{*/
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        if (this.checked) {saveButton.setAttribute('data-task-deadline', 'u');}
    } /*}}}*/

    otherRadio.onchange = function() { /*{{{*/
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        if (this.checked) {saveButton.setAttribute('data-task-deadline', 's');}
    } /*}}}*/

    dateRadio.onchange = function() { /*{{{*/
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        if (this.checked) {
            input = this.nextElementSibling.nextElementSibling;
            errorText = this.parentElement.parentElement.getElementsByClassName('error')[0];
            if (input.value === '') {
                errorText.style.color = 'red';
                setText(errorText, 'Invalid deadline');
                saveButton.disabled = true;
            } else if (errorText.innerText === 'Invalid deadline') {
                setText(errorText, '\u00a0');
                saveButton.disabled = false;
            }
        }
    } /*}}}*/

    dateInput.onchange = function() { /*{{{*/
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        errorText = this.parentElement.parentElement.getElementsByClassName('error')[0];
        saveButton.setAttribute('data-task-deadline', this.value);
        if (this.value === '') {
            errorText.style.color = 'red';
            setText(errorText, 'Invalid deadline');
            saveButton.disabled = true;
        } else if (errorText.innerText === 'Invalid deadline') {
            setText(errorText, '\u00a0');
            saveButton.disabled = false;
        }
    } /*}}}*/ /*}}}*/

    // Add children /*{{{*/
    taskView.appendChild(titleLabel);
    taskView.appendChild(titleInput);
    taskView.appendChild(descLabel);
    taskView.appendChild(descInput);
    taskView.appendChild(element('br'));
    taskView.appendChild(element('br'));
    taskView.appendChild(priLabel);
    taskView.appendChild(priInput);
    taskView.appendChild(deadlineGroup);
    taskView.appendChild(element('br'));
    taskView.appendChild(saveButton);
    taskView.appendChild(document.createTextNode('\u00a0\u00a0'));
    taskView.appendChild(cancelButton);
    taskView.appendChild(document.createTextNode('\u00a0\u00a0'));
    taskView.appendChild(errorText); /*}}}*/ /*}}}*/
} /*}}}*/

function openProject(taskView, project) { /*{{{*/
    deleteAllChildren(taskView, 1);

    // Display current project tree /*{{{*/
    taskView.parentElement.children[0].setAttribute('data-project-id', project.id);
    c = 'black';
    if (useNightTheme()) {c = 'silver';}
    projLinks = createProjectLinks(project.id, c, 1, 1);
    addProjectLinks(projLinks, c, taskView, true); /*}}}*/

    // Delete project button /*{{{*/
    removeProjectLink = element('a');
    removeProjectLink.className = 'blank';
    removeProjectLink.href = '#';
    removeProjectLink.setAttribute('data-project-id', project.id);
    removeProjectLink.setAttribute('data-project-name', project.name);
    removeProjectLink.onclick = function() { /*{{{*/
        deleteProject(this.getAttribute('data-project-id'), 'project', taskView);
    }; /*}}}*/
    removeProjectImg = element('img');
    removeProjectImg.src = 'images/x.png';
    removeProjectImg.alt = 'Remove project';
    removeProjectImg.title = 'Remove project';
    removeProjectLink.appendChild(document.createTextNode('\u00a0\u00a0'));
    removeProjectLink.appendChild(removeProjectImg);

    taskView.appendChild(removeProjectLink); /*}}}*/

    // Create subproject list /*{{{*/
    if (subProjects[project.id]) {
        subProjects[project.id].sort(function(a, b) {return a.name > b.name;});
        subprojectsP = element('p');
        subprojectsP.style.className = 'normal_text';
        tmpP = element('p');
        tmpP.className = 'normal_text';
        tmpP.style.fontSize = '120%';
        tmpP.style.marginBottom = '0px';
        setText(tmpP, 'Subprojects:');
        if (useNightTheme()) {switchToNight(tmpP);}
        subprojectsP.appendChild(tmpP);
        tmpP = element('p');
        tmpP.className = 'normal_text';
        tmpP.style.fontSize = '120%';
        tmpP.style.display = 'inline';
        setText(tmpP, '\u00a0\u00a0\u00a0');
        subprojectsP.appendChild(tmpP);
        for (subp = 0; subp < subProjects[project.id].length; subp++) { /*{{{*/
            subpr = subProjects[project.id][subp];
            subpA = element('a');
            subpA.className = 'normal_text';
            if (useNightTheme()) {switchToNight(subpA);}
            subpA.href = '#';
            subpA.setAttribute('data-project', JSON.stringify(subpr));
            subpA.onclick = function() {
                openProject(taskView, JSON.parse(this.getAttribute('data-project')));
            };
            setText(subpA, subpr.name);
            subprojectsP.appendChild(subpA);

            if (subp != (subProjects[project.id].length - 1)) {
                tmpP = element('p');
                tmpP.className = 'normal_text';
                tmpP.style.display = 'inline';
                setText(tmpP, ',\u00a0');
                if (useNightTheme()) {switchToNight(tmpP);}
                subprojectsP.appendChild(tmpP);
            }
        } /*}}}*/

        if (useNightTheme()) {switchToNight(subprojectsP);}

        taskView.appendChild(subprojectsP);
    } else {
        taskView.appendChild(element('br'));
        taskView.appendChild(element('br'));
    } /*}}}*/

    // Get task list /*{{{*/
    out = getTasksInProject(project.id);
    urgent = out[0];
    other = out[1];
    normal = out[2];
    urgent.sort(sortTasksByPriority);
    other.sort(sortTasksByPriority);
    out = tasksToHTML(urgent, normal, other, 0);
    urgentHeader = out[0];
    urgentHR = out[1];
    urgentTasks = out[2];
    normalTasks = out[3];
    otherHeader = out[4];
    otherHR = out[5];
    otherTasks = out[6]; /*}}}*/

    // Add new task button /*{{{*/
    newTaskP = element('p');
    newTaskP.style.display = 'inline';
    newTaskP.style.cssFloat = 'right';
    newTaskP.style.marginBottom = '2px';
    newTaskButton = element('button');
    newTaskButton.setAttribute('this-project-id', project.id);
    newTaskButton.onclick = function() {
        openTask(makeBlankTask(this.getAttribute('this-project-id')), taskView, 'project');
    }
    setText(newTaskButton, 'Create task');
    newTaskP.appendChild(newTaskButton);

    if (isFirefox()) {newTaskP.style.paddingRight = '15px';}

    if (useNightTheme()) {switchToNight(newTaskButton);}

    taskView.appendChild(newTaskP); /*}}}*/

    // If no tasks, add whitespace /*{{{*/
    if (urgent.length == 0 && other.length == 0 && normal.length == 0) {
        taskView.appendChild(element('br'));
        taskView.appendChild(element('br'));
    } /*}}}*/

    addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks);
    checkTaskHeights(taskView);

    return;

    // Show project's tasks - legacy, leaving for reference /*{{{*/
    // Add new task button /*{{{*/
    newTaskButton = element('button');
    newTaskButton.onclick = function() {
        openTask(makeBlankTask(project.id), taskView);
    }
    setText(newTaskButton, 'Create task');

    if (isFirefox()) {newTaskP.style.paddingRight = 'px';}

    if (useNightTheme()) {switchToNight(newTaskButton);} /*}}}*/

    // If no subprojects, need an extra two line /*{{{*/
    if (!subProjects[project.id]) {
        taskView.appendChild(element('br'));
        taskView.appendChild(element('br'));
    }
    taskView.appendChild(newTaskButton);
    taskView.appendChild(element('br')); /*}}}*/

    // Order tasks alphabetically then by urgent, normal, other /*{{{*/
    myTasks = new Array();
    myUrgent = sortedTasks[0][project.id];
    myOther = sortedTasks[1][project.id];
    myNormal = sortedTasks[2][project.id];
    if (myUrgent) {
        myUrgent.sort(function(a, b) {return (a.name > b.name);});
        myUrgent.forEach(function(e) {myTasks.push(e);});
    }
    if (myNormal) {
        myNormal.sort(function(a, b) {return (a.name > b.name);});
        myNormal.forEach(function(e) {myTasks.push(e);});
    }
    if (myOther) {
        myOther.sort(function(a, b) {return (a.name > b.name);});
        myOther.forEach(function(e) {myTasks.push(e);});
    } /*}}}*/

    // Add tasks table /*{{{*/
    if (myTasks.length > 0) {
        taskView.appendChild(element('br'));

        tasksTable = element('table');
        tasksTable.className = 'notes';

        // Create table header /*{{{*/
        tasksHeader = element('tr');
        tasksTitleCell = element('th');
        tasksTitleCell.style.width = '100%';
        setText(tasksTitleCell, 'Task');
        tasksPriCell = element('th');
        setText(tasksPriCell, 'Priority');
        tasksDeadCell = element('th');
        setText(tasksDeadCell, 'Deadline');
        tasksDelCell = element('th');
        setText(tasksDelCell, 'Delete');
        tasksHeader.appendChild(tasksTitleCell);
        tasksHeader.appendChild(tasksPriCell);
        tasksHeader.appendChild(tasksDeadCell);
        tasksHeader.appendChild(tasksDelCell);

        tasksTable.appendChild(tasksHeader); /*}}}*/

        // Create table rows /*{{{*/
        for (taskNum = 0; taskNum < myTasks.length; taskNum++) {
            task = myTasks[taskNum];

            // Create task row /*{{{*/
            taskRow = element('tr');
            taskRow.style.textAlign = 'center';
            titleCell = element('td');
            titleCell.style.textAlign = 'left';
            taskLink = element('a');
            taskLink.className = 'normal_text';
            taskLink.href = '#';
            taskLink.setAttribute('data-task', JSON.stringify(task));
            taskLink.onclick = function() {
                myTask = JSON.parse(this.getAttribute('data-task'));
                openTask(myTask, taskView);
            };
            if (useNightTheme()) {switchToNight(taskLink);}
            setText(taskLink, task.name);
            titleCell.appendChild(taskLink);
            priCell = element('td');
            priCell.style.paddingRight = '8px';
            setText(priCell, task.priority);
            deadText = 0;
            if (task.is_urgent) {deadText = 'ASAP';}
            else if (task.is_other) {deadText = 'When convenient';}
            else {
                d = deadlineToDate(task.deadline);
                time = getTimeFromString(d.toString());
                deadText = d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' +
                           d.getUTCDate() + ' ' + time;
            }
            deadCell = element('td');
            deadCell.style.whiteSpace = 'nowrap';
            deadCell.style.paddingRight = '8px';
            setText(deadCell, deadText);
            delCell = element('td');
            delCell.style.paddingRight = '8px';
            delLink = element('a');
            delLink.href = '#';
            delLink.setAttribute('data-task', JSON.stringify(task));
            delLink.onclick = function() {
                t = JSON.parse(this.getAttribute('data-task'));
                conf = confirm('Are you sure you want to delete task \'' + t.name + '\'?');
                if (conf) {deleteTask(this.getAttribute('data-task'), taskView, false);}
            };
            delImg = element('img');
            delImg.src = 'images/x.png';
            delImg.alt = 'Remove task';
            delLink.appendChild(delImg);
            delCell.appendChild(delLink); /*}}}*/

            taskRow.appendChild(titleCell);
            taskRow.appendChild(priCell);
            taskRow.appendChild(deadCell);
            taskRow.appendChild(delCell);

            tasksTable.appendChild(taskRow);
        } /*}}}*/

        if (useNightTheme()) {switchToNight(tasksTable);}

        taskView.appendChild(tasksTable);
    } /*}}}*/ /*}}}*/
} /*}}}*/

function deleteTask(task, taskView, returnToOverview) { /*{{{*/
    t = JSON.parse(task);
    deleteTaskReq = createPostReq('tasks.cgi', false);

    deleteTaskReq.onreadystatechange = function() {
        if (reqCompleted(this)) {
            if (this.responseText == 'success') { /*{{{*/
                fetchTaskData();

                if (returnToOverview != '0') {
                    populateUpcoming(taskView);
                } else {
                    openProject(taskView, projectsByID[t.project]);
                } /*}}}*/
            } else if (this.responseText == 'notmine') {/*{{{*/
                alertDisabled();/*}}}*/
            } else { /*{{{*/
                e = taskView.getElementsByClassName('error')[0];
                if (e) {
                    e.style.color = 'red';
                    setText(e, 'Failed to delete task');
                } else {
                    alert('Failed to delete task!');
                }
            } /*}}}*/
        }
    };

    deleteTaskReq.send('mode=3&id=' + t.id);
} /*}}}*/

function deleteProject(projectID, viewMode, taskView) { /*{{{*/
    // Verify project can be deleted and user wants to /*{{{*/
    n = projectsByID[projectID].name;
    if (n === 'Default') {
        alert('The default project can\'t be deleted!');
        exit;
    }
    conf = confirm('Are you sure you want to delete project \'' + n + '\'?');
    if (!conf) {return;} /*}}}*/

    // Delete project /*{{{*/
    deleteProjectReq = createPostReq('tasks.cgi', false);
    deleteProjectReq.onreadystatechange = function() { /*{{{*/
        if (reqCompleted(this)) {
            if (this.responseText == 'notmine') {
                alertDisabled();
            } else if (this.responseText != 'success') {
                alert('Project deletion failed with error ' + this.responseText);
            }
        }
    }; /*}}}*/
    deleteProjectReq.send('mode=4&id=' + projectID); /*}}}*/

    // Reset view /*{{{*/
    fetchTaskData();
    if (viewMode === 'project') {populateUpcoming(taskView);}
    populateProjects(taskView.parentElement.children[0].children[0]); /*}}}*/
} /*}}}*/

/* DOM Creation *//*{{{*/
function projectsToSelect(projectID) { /*{{{*/
   projectSelect = element('select');
    for (root = 0; root < rootProjects.length; root++) { /*{{{*/
        currentRoot = rootProjects[root];
        addOption(currentRoot, 0, projectSelect, projectID);
        if (subProjects[currentRoot.id]) {
            addOptionTree(subProjects[currentRoot.id], 0, projectSelect, projectID);
        }
    } /*}}}*/

    if (useNightTheme()) {switchToNight(projectSelect);}
    return projectSelect;
} /*}}}*/

function tasksToHTML(urgent, normal, other, fromOverview) { /*{{{*/
    redirectView = (fromOverview == 1) ? 'overview' : 'project';
    // Create urgent tasks /*{{{*/
    urgentHeader = element('p');
    urgentHeader.className = 'normal_section_header';
    urgentHeader.style.fontWeight = 'bold';
    urgentHeader.style.marginBottom = '0px';
    setText(urgentHeader, 'ASAP');

    urgentHR = element('hr');
    urgentHR.className = 'task_divider';

    urgentTasks = element('span');
    for (taskNum = 0; taskNum < urgent.length; taskNum++) {
        task = urgent[taskNum];
        addTask(task, urgentTasks, false, fromOverview, redirectView);
    } /*}}}*/

    // Create tasks with deadlines /*{{{*/
    normal.sort(function(a, b) {
        if (deadlineToDate(a.deadline).getTime() == deadlineToDate(b.deadline).getTime()) {
            return sortTasksByPriority(a, b);
        } else {
            return ((deadlineToDate(a.deadline).getTime()) > (deadlineToDate(b.deadline).getTime())) ? 1 : -1;
        }
    });

    currentDate = 0;
    normalTasks = element('span');
    for (taskNum = 0; taskNum < normal.length; taskNum++) {
        task = normal[taskNum];

        d = deadlineToDate(task.deadline);
        // If date has changed /*{{{*/
        if (d.toLocaleDateString() != currentDate) {
            currentDate = d.toLocaleDateString();

            dateHeader = element('p');
            dateHeader.className = 'normal_section_header';
            dateHeader.style.fontWeight = 'bold';
            dateHeader.style.marginBottom = '0px';
            setText(dateHeader, d.toDateString());

            dateHR = element('hr');
            dateHR.className = 'task_divider';
            if (useNightTheme()) {
                switchToNight(dateHeader, dateHR);
            }

            normalTasks.appendChild(dateHeader);
            normalTasks.appendChild(dateHR);
        } /*}}}*/
        addTask(task, normalTasks, true, fromOverview, redirectView);
    } /*}}}*/

    // Create other tasks /*{{{*/
    otherHeader = element('p');
    otherHeader.className = 'normal_section_header';
    otherHeader.style.fontWeight = 'bold';
    otherHeader.style.marginBottom = '0px';
    setText(otherHeader, 'When Possible');

    otherHR = element('hr');
    otherHR.className = 'task_divider';

    otherTasks = element('span');
    for (taskNum = 0; taskNum < other.length; taskNum++) {
        task = other[taskNum];
        addTask(task, otherTasks, false, fromOverview, redirectView);
    } /*}}}*/

    if (useNightTheme()) {switchToNight(urgentHeader, urgentHR, otherHeader, otherHR);}
    return [urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks];
} /*}}}*/

function addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks) { /*{{{*/
    if (urgent.length !== 0) { /*{{{*/
        urgentHeader.style.cssFloat = 'left';
        taskView.appendChild(urgentHeader);
        if (isFirefox()) { /*{{{*/
            urgentHR.style.marginTop = '10px';
            taskView.appendChild(element('br'));
            taskView.appendChild(element('br'));
        } /*}}}*/
        taskView.appendChild(urgentHR);
        taskView.appendChild(urgentTasks);
    } /*}}}*/
    if (normal.length !== 0) { /*{{{*/
        if (urgent.length === 0) {normalTasks.children[0].style.cssFloat = 'left';}
        if (isFirefox()) { /*{{{*/
            if (urgent.length == 0) {
                normalTasks.children[1].style.marginTop = '8px';
            }
            taskView.appendChild(normalTasks.children[0]);
            if (urgent.length == 0) {
                taskView.appendChild(element('br'));
                taskView.appendChild(element('br'));
            }
        } /*}}}*/
        taskView.appendChild(normalTasks);
    } /*}}}*/
    if (other.length !== 0) { /*{{{*/
        if (urgent.length === 0 && normal.length === 0) {otherHeader.style.cssFloat = 'left';}
        taskView.appendChild(otherHeader);
        if (isFirefox() && urgent.length === 0 && normal.length === 0) { /*{{{*/
            otherHR.style.marginTop = '10px';
            taskView.appendChild(element('br'));
            taskView.appendChild(element('br'));
        } /*}}}*/
        taskView.appendChild(otherHR);
        taskView.appendChild(otherTasks);
    } /*}}}*/

    // If no tasks in any section /*{{{*/
    if (urgent.length === 0 && normal.length === 0 && other.length === 0) {
        blank = element('p');
        blank.className = 'normal_text';
        blank.style.marginTop = '0px';
        blank.style.fontStyle = 'italic';
        setText(blank, stringFill('\u00a0', 4) + 'No tasks');

        if (useNightTheme()) {switchToNight(blank);}

        taskView.appendChild(blank);
    } /*}}}*/
} /*}}}*/

function addTask(task, parent, showTime, fromOverview) { /*{{{*/
    color = 0;
    if (task.priority > colors.length) {
        color = colors[colors.length - 1];
    } else {
        color = colors[task.priority - 1];
    }

    projLinks = createProjectLinks(task.project, color, 4, false);

    // If normal, should have a deadline /*{{{*/
    taskDate = 0;
    if (showTime === true) {
        taskDate = element('p');
        taskDate.style.display = 'inline';
        taskDate.style.color = color;

        deadline = deadlineToDate(task.deadline);
        time = getTimeFromString(d.toString());
        setText(taskDate, time + stringFill('\u00a0', 2));
    } /*}}}*/

    // Create task link /*{{{*/
    taskElem = element('p');
    taskElem.className = 'normal_text';
    taskElem.appendChild(document.createTextNode(stringFill('\u00a0', 4)));
    taskElem.style.height = '20px';
    taskElem.style.marginTop = '0px';
    taskElem.style.marginBottom = '5px';
    taskLink = element('a');
    taskLink.className = 'normal_text';
    taskLink.style.color = color;
    taskLink.style.fontWeight = 'bold';
    taskLink.href = '#';
    taskLink.setAttribute('data-task', JSON.stringify(task));
    taskLink.onclick = function() { /*{{{*/
        taskView = this.parentElement.parentElement.parentElement;
        openTask(JSON.parse(this.getAttribute('data-task')), taskView, redirectView);
    }; /*}}}*/
    setText(taskLink, task.name);
    taskProj = element('p');
    taskProj.style.color = color;
    taskProj.style.display = 'inline';

    addProjectLinks(projLinks, color, taskProj, false); /*}}}*/

    // Create delete task /*{{{*/
    delTaskP = element('p');
    delTaskP.style.display = 'inline';
    setText(delTaskP, '\u00a0\u00a0');
    delTaskImg = element('img');
    delTaskImg.src = 'images/x.png';
    delTaskImg.title = 'Delete task';
    delTaskImg.alt = 'Delete task';
    delTaskLink = element('a');
    delTaskLink.href = '#';
    delTaskLink.setAttribute('data-task', JSON.stringify(task));
    delTaskLink.setAttribute('data-from-overview', fromOverview);
    delTaskLink.onclick = function() { /*{{{*/
        t = JSON.parse(this.getAttribute('data-task'));
        conf = confirm('Are you sure you want to delete task \'' + t.name + '\'?');
        if (!conf) {return;}
        deleteTask(this.getAttribute('data-task'), parent.parentElement, this.getAttribute('data-from-overview'));
    }; /*}}}*/
    delTaskLink.appendChild(delTaskImg);
    delTaskP.appendChild(delTaskLink); /*}}}*/

    if (showTime === true) {taskElem.appendChild(taskDate);}
    taskElem.appendChild(taskLink);
    taskElem.appendChild(taskProj);
    taskElem.appendChild(delTaskP);

    if (useNightTheme()) {switchToNight(taskElem, taskLink, taskProj, delTaskP, delTaskLink);}

    parent.appendChild(taskElem);
} /*}}}*/

function checkTaskHeights(taskView) { /*{{{*/
    tasks = taskView.querySelectorAll('p.normal_text');
    for (i = 0; i < tasks.length; i++) {
        taskElem = tasks[i];
        console.log(taskElem);
        for (c = 0; c < taskElem.children.length; c++) {
            if (taskElem.children[c].offsetHeight > 20) {
                taskElem.parentElement.insertBefore(element('br'), taskElem.nextElementSibling);
            }
        }
    }
} /*}}}*/

function addOptionTree(projects, level, select, projectID) { /*{{{*/
    for (s = 0; s < projects.length; s++) {
        p = projects[s];
        addOption(p, level + 1, select, projectID);
        if (subProjects[p.id]) {addOptionTree(subProjects[p.id], level + 1, select, projectID);}
    }
} /*}}}*/

function addOption(project, level, select, projectID) { /*{{{*/
    opt = element('option');
    opt.value = project.id;
    if (project.id == projectID) {opt.selected = 'selected';}
    setText(opt, stringFill('\u00a0', 3 * level) + project.name);
    if (useNightTheme()) {switchToNight(opt);}
    select.appendChild(opt);
} /*}}}*/

function createProjectLinks(projectID, color, levelsToRoot, isTitle) { /*{{{*/
    projLinks = [createProjectLink(projectsByID[projectID], levelsToRoot)];
    projLinks[0].style.color = color;
    projParent = projectHierarchy[projectID];
    while (projectsByID[projParent]) {
        projLinks.push(createProjectLink(projectsByID[projParent], levelsToRoot));
        projLinks[projLinks.length - 1].style.color = color;
        projParent = projectHierarchy[projParent];
    }

    // If this is a title, add an overview link /*{{{*/
    if (isTitle) {
        overviewLink = element('a');
        overviewLink.className = 'normal_text';
        overviewLink.href = '#';
        overviewLink.style.whiteSpace = 'nowrap';
        overviewLink.style.color = color;
        overviewLink.onclick = function() { /*{{{*/
            fetchTaskData();
            populateUpcoming(taskView);
        }; /*}}}*/
        setText(overviewLink, 'Overview');
        projLinks.push(overviewLink);
    } /*}}}*/

    projLinks.reverse();
    return projLinks;
} /*}}}*/

function createProjectLink(project, levelsToRoot) { /*{{{*/
    projAnchor = element('a');
    projAnchor.className = 'normal_text';
    projAnchor.href = '#';
    projAnchor.style.whiteSpace = 'nowrap';
    projAnchor.setAttribute('data-project', JSON.stringify(project));
    projAnchor.setAttribute('data-levels-to-root', levelsToRoot);
    projAnchor.onclick = function() { /*{{{*/
        levels = parseInt(this.getAttribute('data-levels-to-root'), 10);
        taskView = this;
        for (levels = levels; levels > 0; levels--) {taskView = taskView.parentElement;}
        openProj = JSON.parse(this.getAttribute('data-project'));
        openProject(taskView, openProj);
    }; /*}}}*/
    setText(projAnchor, project.name);
    return projAnchor;
} /*}}}*/

function addProjectLinks(projLinks, color, parent, isTitle) { /*{{{*/
    // Add opening bracket /*{{{*/
    if (!isTitle) {
        tmpP = element('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = color;
        setText(tmpP, '\u00a0\u00a0\u00a0&lt;');
        parent.appendChild(tmpP);
    } /*}}}*/

    for (link = 0; link < projLinks.length; link++) { /*{{{*/
        projLink = projLinks[link];
        if (isTitle) {projLink.style.fontWeight = 'bold'; projLink.style.fontSize = '115%';}
        parent.appendChild(projLink);
        // If not on last link
        if (link != (projLinks.length - 1)) {
            tmpP = element('p');
            tmpP.style.display = 'inline';
            tmpP.style.color = color;
            setText(tmpP, '\u00a0: ');
            if (isTitle) {tmpP.style.fontWeight = 'bold'; tmpP.style.fontSize = '115%';}
            parent.appendChild(tmpP);
        }
    } /*}}}*/

    // Add closing bracket /*{{{*/
    if (!isTitle) {
        tmpP = element('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = color;
        setText(tmpP, '&gt;');
        parent.appendChild(tmpP);
    } /*}}}*/
} /*}}}*//*}}}*/ /*}}}*/

/* Reminders *//*{{{*/
function fetchReminders() {/*{{{*/
    getRemindersReq = createPostReq('reminders.cgi', false);
    getRemindersReq.send('mode=0');
    if (getRemindersReq.responseText == 'noauth') {
        alert('Session timed out! Please copy any unsaved changes then refresh the page.');
        return;
    } else if (getRemindersReq.responseText == 'Bad request!') {
        alert('Invalid request! Please copy any unsaved changes then refresh the page.');
        return;
    } else if (getRemindersReq.responseText == 'notmine') {
        alertDisabled();
        return;
    }
    reminders = JSON.parse(getRemindersReq.responseText);

    getContactsReq = createPostReq('reminders.cgi', false);
    getContactsReq.send('mode=3');
    if (getContactsReq.responseText == 'noauth') {
        alert('Session timed out! Please copy any unsaved changes then refresh the page.');
        return;
    } else if (getContactsReq.responseText == 'Bad request!') {
        alert('Invalid request! Please copy any unsaved changes then refresh the page.');
        return;
    } else if (getContactsReq.responseText == 'notmine') {
        alertDisabled();
        return;
    }
    smsContacts = JSON.parse(getContactsReq.responseText);
}/*}}}*/

function makeBlankReminder(type) {/*{{{*/
    reminder = new Object();
    reminder.id = -1;
    reminder.type = type;
    reminder.recipient = ''; 
    reminder.message = '';
    if (type == 'e') {reminder.subject = '';}
    reminder.first = '';
    reminder.repeat = 'o';
    reminder.duration = 'f1';
    return reminder;
}/*}}}*/

function populateReminderList(list) {/*{{{*/
    deleteAllChildren(list);

    remindersHeader = element('p');
    remindersHeader.className = 'normal_section_header';
    setText(remindersHeader, 'Reminders:');

    // Create reminders table/*{{{*/
    remindersTable = element('table');
    remindersTable.className = 'notes';
    remindersHRow = element('tr');
    textCell = element('th');
    setText(textCell, 'Message');
    remindersHRow.appendChild(textCell);
    timeCell = element('th');
    setText(timeCell, 'Time');
    remindersHRow.appendChild(timeCell);

    remindersTable.appendChild(remindersHRow);

    reminderList.appendChild(remindersHeader);
    list.appendChild(remindersTable);/*}}}*/

    if (useNightTheme()) {switchToNight(list, reminderEditor, remindersHeader, remindersTable, textCell, timeCell);}

    // Add reminder data/*{{{*/
    for (rNum = 0; rNum < reminders.length; rNum++) {
        reminder = reminders[rNum];
        row = element('tr');
        row.setAttribute('data-reminder', JSON.stringify(reminder));
        row.onclick = function() {/*{{{*/
            underlines = this.parentElement.getElementsByTagName('u');
            for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
            underlines = this.getElementsByTagName('u');
            for (u = 0; u < underlines.length; u++) {
                underlines[u].className = 'note_edit';
                if (useNightTheme()) {switchToNight(underlines[u]);}
            }
            r = JSON.parse(this.getAttribute('data-reminder'));
            reminderEditor = this.parentElement.parentElement.parentElement.children[1];
            openReminder(r, reminderEditor);
        };/*}}}*/
        row.onmouseover = function() {/*{{{*/
            this.style.fontWeight = 'bold';
            this.style.fontStyle = 'italic';
        };/*}}}*/
        row.onmouseout = function() {/*{{{*/
            this.style.fontWeight = 'normal';
            this.style.fontStyle = 'normal';
        }/*}}}*/

        uClass = 'note_blank';
        if (reminder.id == reminderEditor.getAttribute('data-id')) {uClass = 'note_edit';}

        // Text cell/*{{{*/
        textCell = element('td');
        textUnderline = element('u');
        textUnderline.className = uClass;
        textSpan = element('span');
        textSpan.className = 'normal';
        setText(textSpan, reminder.message);
        textUnderline.appendChild(textSpan);
        textCell.appendChild(textUnderline);
        row.appendChild(textCell);/*}}}*/

        // Time cell/*{{{*/
        timeCell = element('td');
        timeUnderline = element('u');
        timeUnderline.className = uClass;
        timeSpan = element('span');
        timeSpan.className = 'normal';
        setText(timeSpan, reminder.next);
        timeUnderline.appendChild(timeSpan);
        timeCell.appendChild(timeUnderline);
        row.appendChild(timeCell);/*}}}*/
        
        // Delete link/*{{{*/
        deleteLink = element('a');
        deleteLink.style.marginRight = '5px';
        deleteLink.href = '#';
        deleteLink.style.cssFloat = 'right';
        deleteLink.setAttribute('data-id', reminder.id);
        deleteLink.setAttribute('data-name', reminder.message);
        deleteLink.onclick = function() {
            conf = confirm('Are you sure you want to delete \'' + this.getAttribute('data-name') + '\'?');
            rID = this.getAttribute('data-id');
            if (!conf) {return;}
            reminderList = this.parentElement.parentElement.parentElement.parentElement;
            deleteReminderReq = createPostReq('reminders.cgi', false);

            deleteReminderReq.onreadystatechange = function() {/*{{{*/
                if (reqCompleted(this)) {
                    if (reqSuccessful(this)) {
                        reminderEditor = reminderList.parentElement.children[1];
                        fetchReminders();
                        setTimeout(function() {
                            populateReminderList(reminderList);
                            if (reminderEditor.getAttribute('data-id') == rID) {
                                openReminder(makeBlankReminder('e'), reminderEditor);
                                err = reminderEditor.getElementsByClassName('error')[0];
                                err.style.color = 'red';
                                setText(err, '\u00a0');
                            }
                        }, 500);
                    } else if (this.responseText == 'noauth') {
                        alertNoAuth();
                    } else if (this.responseText == 'notmine') {
                        alertDisabled();
                    } else {
                        alert('Failed to delete reminder!');
                    }
                }
            }/*}}}*/

            deleteReminderReq.send('mode=2&id=' + this.getAttribute('data-id'));
        }
        deleteImg = element('img');
        deleteImg.title = 'Delete reminder';
        deleteImg.alt = 'Delete reminder';
        deleteImg.src = 'images/x.png';
        deleteLink.appendChild(deleteImg);
        timeCell.appendChild(deleteLink);/*}}}*/

        if (useNightTheme()) {
            switchToNight(textCell, textUnderline, textSpan, timeCell, timeUnderline, timeSpan);
        }
        remindersTable.appendChild(row);

        textCell.style.width = textCell.offsetWidth + 10 + 'px';
    }/*}}}*/
}/*}}}*/

function openReminders() {/*{{{*/
    // Create reminders panel skeleton /*{{{*/
    reminderPanel = element('div');
    id = 'reminders_' + new Date().getTime();
    reminderPanel.id = id;
    reminderPanel.className = 'reminders';
    reminderPanel.style.display = 'none';

    reminderList = element('div');
    reminderList.className = 'reminder_list';
    reminderPanel.appendChild(reminderList);

    reminderEditor = element('div');
    reminderEditor.className = 'reminder_editor';
    reminderPanel.appendChild(reminderEditor); /*}}}*/

    // Creates reminder editor and opens a new one/*{{{*/
    type = element('p');/*{{{*/
    type.style.display = 'inline-block';
    type.style.marginTop = '20px';
    setText(type, 'Reminder type:\u00a0\u00a0');
    typeSelect = element('select');
    typeSelect.name = 'type';
    eOpt = element('option');
    setText(eOpt, 'Email');
    eOpt.value = 'e';
    typeSelect.appendChild(eOpt);
    if (username == 'root') {
        sOpt = element('option');
        setText(sOpt, 'SMS');
        sOpt.value = 's';
        typeSelect.appendChild(sOpt);
    }
    typeSelect.onchange = function() {
        next = this.nextElementSibling;
        while (next.name != 'message') {
            if (next.tagName == 'INPUT') {
                if (this.value == 's' && next.name == 'subject') {next.disabled = true; next.value = 'N/A';}
                else {next.disabled = false; next.value = '';}
            }
            next = next.nextElementSibling;
        }
        openReminder(makeBlankReminder(this.value), this.parentElement);
    }/*}}}*/

    recipientText = element('p');/*{{{*/
    recipientText.style.display = 'inline-block';
    setText(recipientText, 'Recipient:\u00a0\u00a0');
    recipient = element('input');
    recipient.name = 'recipient';/*}}}*/

    subjectText = element('p');/*{{{*/
    subjectText.style.display = 'inline-block';
    setText(subjectText, '\u00a0\u00a0\u00a0\u00a0Subject:\u00a0\u00a0');
    subject = element('input');
    subject.name = 'subject';/*}}}*/

    messageText = element('p');/*{{{*/
    messageText.style.marginBottom = '0px';
    setText(messageText, '\u00a0Message:');
    message = element('textarea');
    message.name = 'message';
    message.style.position = 'relative';
    message.style.width = '60%';
    message.style.height = '30%';/*}}}*/

    startText = element('p');/*{{{*/
    startText.style.display = 'inline-block';
    startText.style.marginBottom = '3px';
    startText.style.paddingBottom = '3px';
    setText(startText, 'First notification (may only be changed before initial reminder is sent):');
    startTime = createDateInput();
    startTime.name = 'first';
    startTime.style.marginBottom = '10px';/*}}}*/

    once = element('input');/*{{{*/
    once.type = 'radio';
    once.name = 'repeat';
    once.value = 'o';
    onceText = element('p');
    onceText.style.display = 'inline-block';
    onceText.style.marginTop = '5px';
    onceText.style.marginBottom = '5px';
    setText(onceText, 'Remind me once');/*}}}*/

    daily = element('input');/*{{{*/
    daily.type = 'radio';
    daily.name = 'repeat';
    daily.value = 'd';
    dailyText = element('p');
    dailyText.style.display = 'inline-block';
    dailyText.style.marginTop = '5px';
    dailyText.style.marginBottom = '5px';
    setText(dailyText, 'Remind me every\u00a0\u00a0')
    dailyRate = element('input');
    dailyRate.style.width = '50px';
    dailyRate.type = 'number';
    dailyRate.name = 'daily';
    dailyRate.value = 1;
    dailyRate.min = 1;
    dailyRate.onblur = function() {this.value = verifyNum(this.value, 1, 9999);};
    dailyText2 = element('p');
    dailyText2.style.display = 'inline-block';
    dailyText2.style.marginTop = '2px';
    dailyText2.style.marginBottom = '2px';
    setText(dailyText2, '\u00a0\u00a0days');/*}}}*/

    weekly = element('input');/*{{{*/
    weekly.type = 'radio';
    weekly.name = 'repeat';
    weekly.value = 'w';
    weeklyText = element('p');
    weeklyText.style.display = 'inline-block';
    weeklyText.style.marginTop = '5px';
    weeklyText.style.marginBottom = '5px';
    setText(weeklyText, 'Remind me every\u00a0\u00a0')
    weeklyRate = element('input');
    weeklyRate.style.width = '50px';
    weeklyRate.type = 'number';
    weeklyRate.name = 'weekly';
    weeklyRate.value = 1;
    weeklyRate.min = 1;
    weeklyRate.onblur = function() {this.value = verifyNum(this.value, 1, 9999);}
    weeklyText2 = element('p');
    weeklyText2.style.display = 'inline-block';
    weeklyText2.style.marginTop = '2px';
    weeklyText2.style.marginBottom = '2px';
    setText(weeklyText2, '\u00a0\u00a0weeks');/*}}}*/

    weekAlt = element('p');/*{{{*/
    weekAlt.style.display = 'inline-block';
    weekAlt.style.marginTop = '5px';
    weekAlt.style.marginBottom = '5px';
    setText(weekAlt, '\u00a0\u00a0\u00a0\u00a0OR\u00a0\u00a0');

    su = element('input');/*{{{*/
    su.type = 'checkbox';
    su.name = 'repeat_day';
    su.value = '0';
    suText = element('p');
    suText.style.display = 'inline-block';
    suText.style.marginTop = '5px';
    suText.style.marginBottom = '5px';
    setText(suText, 'Sunday\u00a0\u00a0');/*}}}*/

    m = element('input');/*{{{*/
    m.type = 'checkbox';
    m.name = 'repeat_day';
    m.value = '1';
    mText = element('p');
    mText.style.display = 'inline-block';
    mText.style.marginTop = '5px';
    mText.style.marginBottom = '5px';
    setText(mText, 'Monday\u00a0\u00a0');/*}}}*/

    tu = element('input');/*{{{*/
    tu.type = 'checkbox';
    tu.name = 'repeat_day';
    tu.value = '2';
    tuText = element('p');
    tuText.style.display = 'inline-block';
    tuText.style.marginTop = '5px';
    tuText.style.marginBottom = '5px';
    setText(tuText, 'Tuesday\u00a0\u00a0');/*}}}*/

    w = element('input');/*{{{*/
    w.type = 'checkbox';
    w.name = 'repeat_day';
    w.value = '3';
    wText = element('p');
    wText.style.display = 'inline-block';
    wText.style.marginTop = '5px';
    wText.style.marginBottom = '5px';
    setText(wText, 'Wednesday\u00a0\u00a0');/*}}}*/

    th = element('input');/*{{{*/
    th.type = 'checkbox';
    th.name = 'repeat_day';
    th.value = '4';
    thText = element('p');
    thText.style.display = 'inline-block';
    thText.style.marginTop = '5px';
    thText.style.marginBottom = '5px';
    setText(thText, 'Thursday\u00a0\u00a0');/*}}}*/

    f = element('input');/*{{{*/
    f.type = 'checkbox';
    f.name = 'repeat_day';
    f.value = '5';
    fText = element('p');
    fText.style.display = 'inline-block';
    fText.style.marginTop = '5px';
    fText.style.marginBottom = '5px';
    setText(fText, 'Friday\u00a0\u00a0');/*}}}*/

    sa = element('input');/*{{{*/
    sa.type = 'checkbox';
    sa.name = 'repeat_day';
    sa.value = '6';
    saText = element('p');
    saText.style.display = 'inline-block';
    saText.style.marginTop = '5px';
    saText.style.marginBottom = '5px';
    setText(saText, 'Saturday\u00a0\u00a0');/*}}}*//*}}}*/

    monthly = element('input');/*{{{*/
    monthly.type = 'radio';
    monthly.name = 'repeat';
    monthly.value = 'm';
    monthlyText = element('p');
    monthlyText.style.display = 'inline-block';
    monthlyText.style.marginTop = '5px';
    monthlyText.style.marginBottom = '5px';
    setText(monthlyText, 'Remind me every\u00a0\u00a0')
    monthlyRate = element('input');
    monthlyRate.style.width = '50px';
    monthlyRate.type = 'number';
    monthlyRate.name = 'monthly';
    monthlyRate.value = 1;
    monthlyRate.min = 1;
    monthlyRate.onblur = function() {this.value = verifyNum(this.value, 1, 9999);}
    monthlyText2 = element('p');
    monthlyText2.style.display = 'inline-block';
    monthlyText2.style.marginTop = '5px';
    monthlyText2.style.marginBottom = '5px';
    setText(monthlyText2, '\u00a0\u00a0months');/*}}}*/

    yearly = element('input');/*{{{*/
    yearly.type = 'radio';
    yearly.name = 'repeat';
    yearly.value = 'y';
    yearlyText = element('p');
    yearlyText.style.display = 'inline-block';
    yearlyText.style.marginTop = '5px';
    yearlyText.style.marginBottom = '5px';
    setText(yearlyText, 'Remind me every\u00a0\u00a0')
    yearlyRate = element('input');
    yearlyRate.style.width = '50px';
    yearlyRate.type = 'number';
    yearlyRate.name = 'yearly';
    yearlyRate.value = 1;
    yearlyRate.min = 1;
    yearlyRate.onblur = function() {this.value = verifyNum(this.value, 1, 9999);}
    yearlyText2 = element('p');
    yearlyText2.style.display = 'inline-block';
    yearlyText2.style.marginTop = '5px';
    yearlyText2.style.marginBottom = '5px';
    setText(yearlyText2, '\u00a0\u00a0years');/*}}}*/

    finite = element('input');/*{{{*/
    finite.type = 'radio';
    finite.name = 'duration';
    finite.value = 'f';
    finiteText = element('p');
    finiteText.style.display = 'inline-block';
    finiteText.style.marginTop = '5px';
    finiteText.style.marginBottom = '5px';
    setText(finiteText, 'End after\u00a0\u00a0');
    finiteCount = element('input');
    finiteCount.style.width = '50px';
    finiteCount.type = 'number';
    finiteCount.name = 'count';
    finiteCount.value = 1;
    finiteCount.min = 1;
    finiteCount.onblur = function() {this.value = verifyNum(this.value, 1, 9999);}
    finiteText2 = element('p');
    finiteText2.style.display = 'inline-block';
    finiteText2.style.marginTop = '5px';
    finiteText2.style.marginBottom = '5px';
    setText(finiteText2, '\u00a0\u00a0reminders');/*}}}*/

    deadline = element('input');/*{{{*/
    deadline.type = 'radio';
    deadline.name = 'duration';
    deadline.value = 'd';
    deadlineText = element('p');
    deadlineText.style.display = 'inline-block';
    deadlineText.style.marginTop = '5px';
    deadlineText.style.marginBottom = '5px';
    setText(deadlineText, 'End on\u00a0\u00a0');
    deadlineDay = createDateInput();
    deadlineDay.name = 'day';/*}}}*/

    never = element('input');/*{{{*/
    never.type = 'radio';
    never.name = 'duration';
    never.value = 'n';
    neverText = element('p');
    neverText.style.display = 'inline-block';
    neverText.style.marginTop = '5px';
    neverText.style.marginBottom = '5px';
    setText(neverText, 'Indefinitely');/*}}}*/

    saveButton = element('button');
    setText(saveButton, 'Save reminder');
    saveButton.onclick = function() {/*{{{*/
        reminderEditor = this.parentElement;
        errorP = reminderEditor.getElementsByClassName('error')[0];
        errorP.style.color = 'red';
        setText(errorP, '\u00a0');

        type = reminderEditor.getElementsByTagName('select')[0].value;

        message = reminderEditor.getElementsByTagName('textarea')[0].value;/*{{{*/
        if (message == '' && type == 's') {
            setText(errorP, 'You must include a message');
            return;
        }/*}}}*/

        inputs = reminderEditor.getElementsByTagName('input');
        for (i = 0; i < inputs.length; i++) {/*{{{*/
            input = inputs[i];
            if (type == 'e') {/*{{{*/
                if (input.name == 'recipient') {/*{{{*/
                    recipient = input.value;
                    if (recipient == '') {
                        setText(errorP, 'You must specify at least one recipient');
                        return;
                    } else {
                        recipients = recipient.split(',');
                        for (r = 0; r < recipients.length; r++) {
                            recip = recipients[r];
                            if (!/ *[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}/.test(recip)) {
                                setText(errorP, 'Recipient ' + recip + ' is not valid');
                                return;
                            }
                        }
                    }/*}}}*/
                } else if (input.name == 'subject') {/*{{{*/
                    subject = input.value;
                }/*}}}*/ /*}}}*/
            } else if (type == 's' && input.name == 'recipient') {/*{{{*/
                recipient = input.value;
                if (recipient == '') {
                    setText(errorP, 'You must specify at least one recipient');
                    return;
                } else {
                    recipients = recipient.split(',');
                    for (r = 0; r < recipients.length; r++) {
                        recip = recipients[r];
                        recip = recip.replace(/^ +| +$/g, '');
                        if (smsContacts.indexOf(recip) == -1) {
                            setText(errorP, 'Contact ' + recip + ' does not exist!');
                            return;
                        }
                    }
                }
            }/*}}}*/

            if (input.name == 'first') {/*{{{*/
                first = input.value;
                if (first == '' || /[a-su-zA-SU-Z]/.test(first)) {
                    setText(errorP, 'You must include a start time');
                    return;
                }/*}}}*/
            } else if (input.name == 'repeat' && input.checked) {/*{{{*/
                if (input.value == 'w') {/*{{{*/
                    repeat = 'w';
                    n = input.nextElementSibling;
                    while (n.type != 'checkbox') {n = n.nextElementSibling;}
                    days = [];
                    while (n.type != 'radio') {
                        if (n.type == 'checkbox' && n.checked) {days.push(n.value);}
                        n = n.nextElementSibling;
                    }
                    if (days.length == 0) {repeat += input.nextElementSibling.nextElementSibling.value;}
                    else {repeat += '[' + days.join('') + ']';}/*}}}*/
                } else if (input.value != 'o') {/*{{{*/
                    repeat = input.value + input.nextElementSibling.nextElementSibling.value;/*}}}*/
                } else {/*{{{*/
                    repeat = 'o';
                }/*}}}*/
                if (!/^[a-z][0-9\[\]]+$/.test(repeat) && repeat != 'o') {
                    setText(errorP, 'Invalid repeat mode');
                    return;
                }/*}}}*/
            } else if (input.name == 'duration' && input.checked) {/*{{{*/
                if (input.value == 'n') {duration = 'n';}
                else {duration = input.value + input.nextElementSibling.nextElementSibling.value;}
                if (!/^[a-z][T0-9 :-]+$/.test(duration) && duration != 'n') {
                    setText(errorP, 'Invalid duration');
                    return;
                }
            }/*}}}*/
        }/*}}}*/

        saveReminderReq = createPostReq('reminders.cgi', false);

        saveReminderReq.onreadystatechange = function() {/*{{{*/
            if (reqCompleted(this)) {
                if (this.responseText.indexOf('success') != -1) {
                    response = this.responseText;
                    errorP.style.color = 'green';
                    setText(errorP, 'Saved at ' + getTimeFromString(new Date().toString()));
                    setTimeout(function() {
                        fetchReminders();
                        setTimeout(function() {
                            rID = response.split('-')[0];
                            for (r = 0; r < reminders.length; r++) {
                                if (reminders[r].id == rID) {openReminder(reminders[r], reminderEditor);}
                            }
                            populateReminderList(reminderEditor.parentElement.children[0]);
                        }, 500);
                    }, 500);
                } else if (this.responseText == 'noauth') {
                    alertNoAuth();
                } else if (this.responseText == 'notmine') {
                    alertDisabled();
                } else {
                    setText(errorP, 'Failed to save reminder - ' + this.responseText);
                }
            }
        };/*}}}*/

        template = 'mode=1&id=%s&type=%s&recipient=%s&message=%s&first=%s&repeat=%s&duration=%s';
        parameters = sprintf(template, this.parentElement.getAttribute('data-id'), type, recipient, message, first, repeat, duration);

        if (type == 'e') {
            parameters += '&subject=' + subject;
        }
        saveReminderReq.send(parameters);
    };/*}}}*/

    cancelButton = element('button');
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() {openReminder(makeBlankReminder('e'), this.parentElement);}

    errorP = element('p');
    errorP.className = 'error';
    errorP.style.display = 'inline-block';
    setText(errorP, '\u00a0');

    if (useNightTheme()) {/*{{{*/
        switchToNight(
            type, typeSelect, recipientText, recipient,
            subjectText, subject, messageText, message,
            startText, startTime,
            once, onceText,
            daily, dailyText, dailyRate, dailyText2,
            weekly, weeklyText, weeklyRate, weeklyText2,
            weekAlt, su, suText, m, mText, tu, tuText, w, wText, th, thText, f, fText, sa, saText,
            monthly, monthlyText, monthlyRate, monthlyText2,
            yearly, yearlyText, yearlyRate, yearlyText2,
            finite, finiteText, finiteCount, finiteText2,
            deadline, deadlineText, deadlineDay,
            never, neverText,
            saveButton, cancelButton
        );
    }/*}}}*/

    // Add elements/*{{{*/
    reminderEditor.appendChild(type);
    reminderEditor.appendChild(typeSelect);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(recipientText);
    reminderEditor.appendChild(recipient);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(subjectText);
    reminderEditor.appendChild(subject);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(messageText);
    reminderEditor.appendChild(message);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(startText);/*{{{*/
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(startTime);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(once);
    reminderEditor.appendChild(onceText);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(daily);
    reminderEditor.appendChild(dailyText);
    reminderEditor.appendChild(dailyRate);
    reminderEditor.appendChild(dailyText2);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(weekly);
    reminderEditor.appendChild(weeklyText);
    reminderEditor.appendChild(weeklyRate);
    reminderEditor.appendChild(weeklyText2);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(weekAlt);/*{{{*/
    reminderEditor.appendChild(su);
    reminderEditor.appendChild(suText);
    reminderEditor.appendChild(m);
    reminderEditor.appendChild(mText);
    reminderEditor.appendChild(m);
    reminderEditor.appendChild(mText);
    reminderEditor.appendChild(tu);
    reminderEditor.appendChild(tuText);
    reminderEditor.appendChild(w);
    reminderEditor.appendChild(wText);
    reminderEditor.appendChild(th);
    reminderEditor.appendChild(thText);
    reminderEditor.appendChild(f);
    reminderEditor.appendChild(fText);
    reminderEditor.appendChild(sa);
    reminderEditor.appendChild(saText);/*}}}*/
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(monthly);
    reminderEditor.appendChild(monthlyText);
    reminderEditor.appendChild(monthlyRate);
    reminderEditor.appendChild(monthlyText2);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(yearly);
    reminderEditor.appendChild(yearlyText);
    reminderEditor.appendChild(yearlyRate);
    reminderEditor.appendChild(yearlyText2);/*}}}*/
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(finite);
    reminderEditor.appendChild(finiteText);
    reminderEditor.appendChild(finiteCount);
    reminderEditor.appendChild(finiteText2);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(deadline);
    reminderEditor.appendChild(deadlineText);
    reminderEditor.appendChild(deadlineDay);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(never);
    reminderEditor.appendChild(neverText);
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(element('br'));
    reminderEditor.appendChild(saveButton);
    reminderEditor.appendChild(document.createTextNode('\u00a0\u00a0'));
    reminderEditor.appendChild(cancelButton);
    reminderEditor.appendChild(document.createTextNode('\u00a0\u00a0'));
    reminderEditor.appendChild(errorP);
    /*}}}*/

    if (!/^[0-9]+$/.test(reminderEditor.getAttribute('data-id'))) {
        openReminder(makeBlankReminder('e'), reminderEditor);
    }
    /*}}}*/

    fetchReminders();

    // Add tab/*{{{*/
    reminderTab = element('div');
    reminderTab.className = 'tab';
    setText(reminderTab, 'Reminders');
    reminderTab.setAttribute('data-id', id);
    reminderTab.onclick = function() {switchTab(this.getAttribute('data-id'));}
    addTab(reminderPanel, reminderTab);
    reminderPanel.style.display = 'block';
    switchTab(id);/*}}}*/

    message.style.left = subject.offsetLeft + 'px';
    populateReminderList(reminderList);
}/*}}}*/

function openReminder(reminder, reminderEditor) {/*{{{*/
    reminderEditor.setAttribute('data-id', reminder.id);

    repeatMode = reminder.repeat[0];
    repeatCount = reminder.repeat.slice(1);
    endMode = reminder.duration[0];
    endCount = reminder.duration.slice(1);

    elems = reminderEditor.children;
    for (eNum = 0; eNum < elems.length; eNum++) {/*{{{*/
        e = elems[eNum];
        if (e.tagName == 'SELECT') {/*{{{*/
            e.value = reminder.type;/*}}}*/
        } else if (e.tagName == 'INPUT') {/*{{{*/
            if (reminder.type == 's') {/*{{{*/
                if (e.name == 'subject') {
                    e.value = 'N/A';
                    e.disabled = true;
                }/*}}}*/
            } else {/*{{{*/
                if (e.name == 'subject') {
                    e.value = reminder.subject;
                    e.disabled = false;
                }
            }/*}}}*/

            if (e.name == 'recipient') {/*{{{*/
                e.value = reminder.recipient;
            }/*}}}*/
            else if (e.name == 'first') {/*{{{*/
                if (reminder.next > reminder.first) {e.disabled = true;}
                t = reminder.first;
                if (t != '') {
                    t = t.replace(' ', 'T');
                    t = t.split(':');
                    t = t[0] + ':' + t[1];
                } else {t = 'YYYY-MM-DD HH:MM';}
                e.value = t;/*}}}*/
            } else if (e.name == 'repeat' && e.value == repeatMode) {/*{{{*/
                e.checked = true;
                n = e.nextElementSibling;
                if (repeatCount.indexOf('[') == -1 && repeatMode != 'o') {
                    while (n.tagName != 'INPUT' || n.type != 'number') {n = n.nextElementSibling;}
                    n.value = repeatCount;
                } else if (repeatMode != 'o') {
                    days = repeatCount;
                    checkboxNum = 0;
                    while (n.value != 'm') {
                        if (n.type == 'checkbox') {
                            if (days.indexOf(n.value) != -1) {n.checked = true;}
                            checkboxNum++;
                        }
                        n = n.nextElementSibling;
                    }
                }/*}}}*/
            } else if (e.name == 'duration' && e.value == endMode) {/*{{{*/
                e.checked = true;
                if (endCount.length) {
                    n = e.nextElementSibling;
                    while (n.tagName != 'INPUT') {n = n.nextElementSibling;}
                    if (e.value == 'd') {
                        endCount = endCount.replace(' ', 'T');
                        endCount = endCount.split(':');
                        endCount = endCount[0] + ':' + endCount[1];
                    }
                    n.value = endCount;
                }
            }/*}}}*//*}}}*/
        } else if (e.tagName == 'TEXTAREA') {/*{{{*/
            e.value = reminder.message;
        }/*}}}*/
    }/*}}}*/
}/*}}}*/

/*}}}*/

/* Account Management */ /*{{{*/
function viewAccount() { /*{{{*/
    id = 'my_account_' + new Date().getTime();
    accountPanel = element('div');
    accountPanel.id = id;

    openAccount(accountPanel);
     
    // Create tab and display panel
    accountTab = element('div');
    setText(accountTab, 'My Account');
    accountTab.className = 'tab';
    accountTab.setAttribute('data-id', id);
    accountTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(accountPanel, accountTab);
    switchTab(id);
} /*}}}*/

function openAccount(accountPanel) {/*{{{*/
    usersReq = createPostReq('account.cgi', false);

    usersReq.onreadystatechange = function() { /*{{{*/
        if (reqCompleted(this)) {
            deleteAllChildren(accountPanel, true);
            data = this.responseText;
            data = JSON.parse(data);
            accountType = data[0];
            domains = data[1];
            services = data[2];
            myServices = data[3];
            myS = [];
            for (s = 0; s < myServices.length; s++) {
                myS.push(services[myServices[s]].service);
            }
            myS.sort();
            myS = myS.join(', ');

            myDomain = domains[domain].name;

            if (username != 'root') {/*{{{*/
                serviceP = element('p');
                serviceP.className = 'normal_text';
                setText(serviceP, 'You may access the following services: ' + myS);
                domainP = element('p');
                domainP.className = 'normal_text';
                setText(domainP, 'You may access the server from ' + myDomain);

                if (useNightTheme()) {switchToNight(serviceP, domainP);}

                accountPanel.appendChild(serviceP);
                accountPanel.appendChild(domainP);
            }/*}}}*/
    
            // If account isn't shared, show password box and theme/*{{{*/
            if (accountType != 'shared') { 
                passText = element('p');
                passText.className = 'normal_section_header';
                passText.style.paddingBottom = '0px';
                passText.style.marginBottom = '10px';
                setText(passText, 'Update Password');

                // Divs for alignment /*{{{*/
                pBox = element('div');
                pBox.style.display = 'inline-block';
                pBox.style.textAlign = 'center';
                pBox.className = 'normal';
                iBox = element('div');
                iBox.style.textAlign = 'left'; /*}}}*/

                // Text /*{{{*/
                error_p = element('p');
                error_p.id = 'pass_error_' + id;
                error_p.className = 'error';
                error_p.style.fontWeight = 'bold';
                error_p.style.paddingTop = '0px';
                error_p.style.paddingBottom = '0px';
                error_p.style.marginTop = '0px';
                error_p.style.marginBottom = '10px';
                setText(error_p, '\u00a0');

                p = element('p');
                p.style.display = 'inline-block';
                p.style.textAlign = 'right';
                p.style.paddingTop = '0px';
                p.style.paddingBottom = '0px';
                p.style.marginTop = '0px';
                p.style.marginBottom = '0px'; /*}}}*/

                // Inputs /*{{{*/
                p1 = element('input');
                p1.type = 'password';
                p1.id = 'pass_' + id;
                p1.setAttribute('data-button-id', 'update_pass_' + id);
                p1.setAttribute('data-other-input-id', 'pass_verify_' + id);
                p1.setAttribute('data-error-id', 'pass_error_' + id);
                p2 = element('input');
                p2.id = 'pass_verify_' + id;
                p2.type = 'password';
                p2.setAttribute('data-button-id', 'update_pass_' + id);
                p2.setAttribute('data-other-input-id', 'pass_' + id);
                p2.setAttribute('data-error-id', 'pass_error_' + id); /*}}}*/

                p1.onkeyup = function() { /*{{{*/
                    b = document.getElementById(this.getAttribute('data-button-id'));
                    if (this.value === '' || this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ===
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        b.disabled = false;
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        b.disabled = true;
                    }
                }; /*}}}*/
                p1.onchange = function() { /*{{{*/
                    if (this.value === '' || this.value.length < 8) {
                        if (this.value) {
                            setText(document.getElementById(this.getAttribute('data-error-id')),
                                    'Password must have at least 8 characters');
                        }
                    } else if (this.value ===
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Passwords don\'t match');
                    }
                }; /*}}}*/
                p2.onkeyup = function() { /*{{{*/
                    b = document.getElementById(this.getAttribute('data-button-id'));
                    if (this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ===
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        b.disabled = false;
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        b.disabled = true;
                    }
                }; /*}}}*/
                p2.onchange = function() { /*{{{*/
                    if (this.value.length >= 8 && this.value ===
                            document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else if (this.value.length < 8) {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Password must have at least 8 characters');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Passwords don\'t match');
                    }
                }; /*}}}*/

                updateButton = element('button');
                updateButton.id = 'update_pass_' + id;
                updateButton.disabled = true;
                updateButton.setAttribute('data-pass-id', 'pass_' + id);
                updateButton.setAttribute('data-error-id', 'pass_error_' + id);
                updateButton.onclick = function() { /*{{{*/
                    updatePassReq = new XMLHttpRequest();
                    error_id = this.getAttribute('data-error-id');

                    updatePassReq.onreadystatechange = function() { /*{{{*/
                        if (reqCompleted(this)) {
                            e = document.getElementById(error_id);
                            switch(this.responseText) {
                                case 'success':
                                    e.style.color = 'green';
                                    setText(e, 'Password changed successfully');
                                    break;
                                case 'none':
                                    setText(e, 'Failed to change password!');
                                    break;
                                case 'extra':
                                    setText(e, 'Multiple passwords changed!');
                                    break;
                                default:
                                    setText(e, 'Failed to change password!');
                                    break;
                            }
                        }
                    }; /*}}}*/
                    updatePassReq.open('POST', 'account.cgi', true);
                    updatePassReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    updatePassReq.send('mode=1&p=' +
                        CryptoJS.AES.encrypt(document.getElementById(this.getAttribute('data-pass-id')).value, master_key));
                }; /*}}}*/
                setText(updateButton, 'Update Password');

                // Switch to night theme if appropriate
                if (useNightTheme()) {
                    switchToNight(passText, pBox, p1, p2, updateButton);
                }

                // Add children /*{{{*/
                p.appendChild(document.createTextNode('Enter password:\u00a0\u00a0'));
                p.appendChild(p1);
                p.appendChild(element('br'));
                p.appendChild(document.createTextNode('Enter password again:\u00a0\u00a0'));
                p.appendChild(p2);
                p.appendChild(element('br'));
                iBox.appendChild(p);
                pBox.appendChild(error_p);
                pBox.appendChild(iBox);
                pBox.appendChild(element('br'));
                pBox.appendChild(updateButton);

                accountPanel.appendChild(passText);
                accountPanel.appendChild(pBox); /*}}}*/

                // Theme selection shouldn't be allowed for shared accounts
                // to avoid conflict
                // Elements /*{{{*/
                themeP = element('p');
                themeP.className = 'normal_text';
                setText(themeP, 'Night theme:&nbsp;&nbsp;');
                themeS = element('select');
                themeS.setAttribute('data-error-id', 'theme_error_' + id);
                opt1 = element('option');
                opt1.value = 0;
                setText(opt1, 'Never');
                opt2 = element('option');
                opt2.value = 1;
                setText(opt2, 'After 7 PM local time');
                opt3 = element('option');
                opt3.value = 2;
                setText(opt3, 'Always');
                opts = [opt1, opt2, opt3];
                opts[document.body.getAttribute('data-night-theme')].selected = true;
                themeError = element('span');
                themeError.id = 'theme_error_' + id;
                themeError.className = 'error';
                themeError.fontWeight = 'bold';
                themeError.style.paddingLeft = '10px';
                setText(themeError, '\u00a0'); /*}}}*/

                themeS.onchange = function() { /*{{{*/
                    updateThemeReq = new XMLHttpRequest();
                    error = document.getElementById(this.getAttribute('data-error-id'));
                    theme = this.value;

                    updateThemeReq.onreadystatechange = function() { /*{{{*/
                        if (reqCompleted(this)) {
                            switch(this.responseText) {
                                case 'success':
                                    error.style.color = 'green';
                                    setText(error, 'Saved.');
                                    document.body.setAttribute('data-night-theme', theme);
                                    break;
                                default:
                                    error.style.color = 'red';
                                    setText(error, 'Failed.');
                                    break;
                            }
                        }
                    }; /*}}}*/

                    updateThemeReq.open('POST', 'account.cgi', false);
                    updateThemeReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    updateThemeReq.send('mode=2&theme=' + this.value);

                }; /*}}}*/

                if (useNightTheme()) {
                    switchToNight(themeP, themeS, opt1, opt2, opt3);
                }

                themeS.appendChild(opt1);
                themeS.appendChild(opt2);
                themeS.appendChild(opt3);
                themeP.appendChild(themeS);
                themeP.appendChild(themeError);
                accountPanel.appendChild(element('br'));
                accountPanel.appendChild(element('br'));
                accountPanel.appendChild(themeP);
            } /*}}}*/

            if (username == 'root') {/*{{{*/
                userServices = data[4];
                users = data[5];
                uKeys = Object.keys(users);
                dKeys = Object.keys(domains);
                sKeys = Object.keys(services);
                usKeys = Object.keys(userServices);

                // Alphabetize users
                uKeys.sort(function(a, b) {return (users[a].username > users[b].username) ? 1 : -1;});

                // Create user button
                createUser = element('button');
                setText(createUser, 'New user');
                createUser.onclick = function() {/*{{{*/
                    un = prompt('New username:');
                    if (!un) {return;}

                    p = '';
                    choices = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789;,.<>?-=_+'
                    for (c = 0; c < 15; c++) {
                        p += choices.charAt(Math.floor(Math.random() * choices.length));
                    }

                    createUserReq = createPostReq('account.cgi', true);

                    createUserReq.onreadystatechange = function() {
                        if (reqFailed(this)) {alert('Failed to create user!');}
                        if (reqSuccessful(this)) {
                            alert('The user\'s new password is: ' + p + '\n\nPlease transmit it to them via a secure channel.');
                            openAccount(accountPanel);
                        }
                    }

                    accountPanel = this.parentElement;
                    createUserReq.send('mode=6&u=' + un + '&p=' + CryptoJS.AES.encrypt(p, master_key).toString());
                };/*}}}*/

                // Table headers/*{{{*/
                userTable = element('table');
                userTable.className = 'notes';
                userTable.style.width = 'auto';
                headerRow = element('tr');
                hName = element('th');
                setText(hName, 'Username');
                hDomain = element('th');
                setText(hDomain, 'Domain');
                hServices = element('th');
                setText(hServices, 'Services');
                hDisable = element('th');
                setText(hDisable, 'Disabled');
                hDelete = element('th');
                setText(hDelete, 'Delete user');
                hReset = element('th');
                setText(hReset, 'Reset password');

                if (useNightTheme()) {switchToNight(createUser, userTable, hName, hDomain, hServices, hDisable, hDelete, hReset);}
                headerRow.appendChild(hName);
                headerRow.appendChild(hDomain);
                headerRow.appendChild(hServices);
                headerRow.appendChild(hDisable);
                headerRow.appendChild(hDelete);
                headerRow.appendChild(hReset);
                for (c = 0; c < 6; c++) {
                    headerRow.children[c].style.paddingRight = '5px';
                }
                userTable.appendChild(headerRow);/*}}}*/

                for (u = 0; u < uKeys.length; u ++) {/*{{{*/
                    user = users[uKeys[u]];
                    if (user.username == 'root') {continue;}
                    row = element('tr');

                    // Name input/*{{{*/
                    nCell = element('td');
                    nCell.style.paddingRight = '5px';
                    nInput = element('input');
                    nInput.type = 'text';
                    nInput.name = 'name' + user.id;
                    nInput.value = user.username;
                    nInput.setAttribute('data-id', user.id);
                    nInput.setAttribute('data-old', user.username);
                    nInput.onblur = function() {/*{{{*/
                        nameInput = this;
                        nameReq = createPostReq('account.cgi', true);

                        nameReq.onreadystatechange = function() {
                            if (reqFailed(this)) {alert('Failed to change username to ' + nameInput.value + '!'); nameInput.value = nameInput.getAttribute('data-old');}
                            else if (reqCompleted(this)) {nameInput.setAttribute('data-old', nameInput.value);}
                        }
                        nameReq.send('mode=3&field=username' + this.getAttribute('data-id') + '&value=\'' + this.value + '\'');
                    }/*}}}*/
                    nCell.appendChild(nInput);/*}}}*/

                    // Domain selection/*{{{*/
                    dCell = element('td');
                    domainSelect = element('select');
                    domainSelect.name = 'domain' + user.id;
                    for (d = 0; d < dKeys.length; d++) {
                        k = dKeys[d];
                        o = element('option');
                        setText(o, domains[k].title);
                        o.value = domains[k].id;
                        if (o.value == user.domain) {o.selected = true;}
                        domainSelect.appendChild(o);
                        if (useNightTheme()) {switchToNight(o);}
                    }
                    domainSelect.setAttribute('data-id', user.id);
                    domainSelect.onfocus = function() {this.setAttribute('data-old', this.value);}
                    domainSelect.onchange = function() {/*{{{*//*{{{*/
                        select = this;
                        domainReq = createPostReq('account.cgi', true);

                        domainReq.onreadystatechange = function() {
                            if (reqFailed(this)) {
                                select.value = select.getAttribute('data-old');
                                alert('Failed to save domain!');
                            }
                        }

                        domainReq.send('mode=3&field=domain' + this.getAttribute('data-id') + '&value=' + this.value);
                    };/*}}}*//*}}}*/
                    dCell.appendChild(domainSelect);/*}}}*/

                    // Services/*{{{*/
                    sCell = element('td');
                    sSpan = element('span');
                    sLink = element('a');
                    sLink.className = 'normal_text';
                    setText(sLink, 'Edit services');
                    sLink.href = '#';
                    sLink.setAttribute('data-id', user.id);
                    sLink.setAttribute('data-services', JSON.stringify(userServices[user.id]));
                    sLink.onclick = function() {/*{{{*/
                        myServices = JSON.parse(this.getAttribute('data-services'));
                        link = this;

                        wnd = window.open('', '', 'width=600,height=150');
                        b = wnd.document.body;
                        b.style.background = '#333';
                        b.style.color = 'silver';
                        b.style.fontFamily = 'Arial';
                        stylesheet = element('link');
                        stylesheet.rel = 'stylesheet';
                        stylesheet.type = 'text/css';
                        stylesheet.href = 'res/style.css';
                        b.appendChild(stylesheet);

                        title = element('p')
                        title.style.fontWeight = 'bold';
                        title.style.fontSize = '14pt';
                        setText(title, 'Select services');
                        b.appendChild(title);

                        for (s = 0; s < sKeys.length; s++) {
                            se = services[sKeys[s]];
                            d = element('div');
                            d.style.display = 'inline-block';
                            d.style.float = 'left';
                            p = element('p');
                            p.style.display = 'inline-block';
                            setText(p, '\u00a0\u00a0' + se.service + '\u00a0');

                            i = element('input');
                            i.type = 'checkbox';
                            i.checked = (myServices.indexOf(parseInt(se.id, 10)) != -1);
                            i.setAttribute('data-id', this.getAttribute('data-id'));
                            i.setAttribute('data-service', se.id);
                            i.onclick = function() {
                                toggleServiceReq = createPostReq('account.cgi', true);
                                input = this;

                                toggleServiceReq.onreadystatechange = function() {
                                    if (reqFailed(this)) {
                                        input.checked = !input.checked;
                                        alert('Failed to update service!');
                                    } else if (reqCompleted(this)) {
                                        uid = parseInt(input.getAttribute('data-id'), 10);
                                        sid = parseInt(input.getAttribute('data-service'), 10);
                                        if (input.checked) {
                                            userServices[uid].push(sid);
                                        } else {
                                            userServices[uid] = userServices[uid].filter(function(e) {return (e != sid);});
                                        }
                                        link.setAttribute('data-services', JSON.stringify(userServices[uid]));
                                    }
                                };

                                toggleServiceReq.send('mode=5&u=' + this.getAttribute('data-id') + '&s=' + this.getAttribute('data-service') + '&c=' + this.checked);
                            };

                            d.appendChild(p);
                            d.appendChild(i);
                            b.appendChild(d);
                        }

                    };/*}}}*/
                    sSpan.appendChild(sLink);
                    sCell.appendChild(sSpan);/*}}}*/

                    // Disabled/*{{{*/
                    diCell = element('td');
                    diCell.style.textAlign = 'center';
                    disabled = element('input');
                    disabled.type = 'checkbox';
                    disabled.name = 'disabled' + user.id;
                    disabled.checked = user.disabled;
                    disabled.setAttribute('data-id', user.id);
                    disabled.onchange = function() {/*{{{*/
                        disableReq = createPostReq('account.cgi', true);
                        disableReq.onreadystatechange = function() {
                            if (reqFailed(this)) {alert('Failed to change disable status!');}
                        }
                        disableReq.send('mode=3&field=disabled' + this.getAttribute('data-id') + '&value=' + this.checked);
                    };/*}}}*/
                    diCell.appendChild(disabled);/*}}}*/

                    // Delete user /*{{{*/
                    deCell = element('td');
                    deCell.style.textAlign = 'center';
                    deleteLink = element('a');
                    deleteImg = element('img');
                    deleteImg.src = 'images/x.png';
                    deleteImg.alt = 'Delete user';
                    deleteImg.title = 'Delete user';
                    deleteLink.appendChild(deleteImg);
                    deleteLink.href = '#';
                    deleteLink.setAttribute('data-id', user.id);
                    deleteLink.setAttribute('data-name', user.username);
                    deleteLink.onclick = function() {/*{{{*/
                        accountPanel = this.parentElement.parentElement.parentElement.parentElement;
                        conf = confirm('Are you sure you want to delete ' + this.getAttribute('data-name') + ' ? This will permanently delete ALL of their data!');
                        if (!conf) {return;}
                        delUserReq = createPostReq('account.cgi', true);

                        delUserReq.onreadystatechange = function() {/*{{{*/
                            if (reqCompleted(this)) {
                                if (reqSuccessful(this)) {openAccount(accountPanel);}
                                else if (this.responseText == 'noauth') {alertNoAuth();}
                                else if (this.responseText == 'failed') {alert('Failed to delete user!');}
                                else {alert(this.responseText);}
                            }
                        };/*}}}*/
                        
                        delUserReq.send('mode=4&id=' + this.getAttribute('data-id'));
                    };/*}}}*/
                    deCell.appendChild(deleteLink);/*}}}*/

                    // Reset user password/*{{{*/
                    rCell = element('td');
                    reset = element('a');
                    reset.className = 'normal_text';
                    reset.href = '#';
                    setText(reset, 'Reset password');
                    reset.setAttribute('data-id', user.id);
                    reset.setAttribute('data-name', user.username);
                    reset.onclick = function() {/*{{{*/
                        conf = confirm('Are you sure you want to reset ' + this.getAttribute('data-name') + '\'s password?');
                        if (!conf) {return;}
                        newPass = '';
                        choices = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789;,.<>?-=_+'
                        for (c = 0; c < 15; c++) {
                            newPass += choices.charAt(Math.floor(Math.random() * choices.length));
                        }

                        resetPassReq = createPostReq('account.cgi', true);

                        resetPassReq.onreadystatechange = function() {
                            if (reqCompleted(this)) {
                                if (this.responseText == 'success') {
                                    alert('The user\'s new password is: ' + newPass + '\n\nPlease transmit it to them via a secure channel.');
                                } else if (this.responseText == 'noauth') {
                                    alertNoAuth();
                                } else {alert('Failed to reset password!');}
                            }
                        };

                        resetPassReq.send('mode=3&field=pw' + this.getAttribute('data-id') + '&value=' + CryptoJS.AES.encrypt(newPass, master_key).toString());
                    }/*}}}*/
                    rCell.appendChild(reset);/*}}}*/

                    // Add elements/*{{{*/
                    row.appendChild(nCell);
                    row.appendChild(dCell);
                    row.appendChild(sCell);
                    row.appendChild(diCell);
                    row.appendChild(deCell);
                    row.appendChild(rCell);
                    userTable.appendChild(row);/*}}}*/
                    
                    if (useNightTheme()) {switchToNight(nCell, nInput, dCell, domainSelect, sCell, sLink, diCell, disabled, deCell, deleteLink, rCell, reset);}
                }/*}}}*/

                accountPanel.appendChild(element('br'));
                accountPanel.appendChild(createUser);
                accountPanel.appendChild(element('br'));
                accountPanel.appendChild(element('br'));
                accountPanel.appendChild(userTable);
                setTimeout(function() {hServices.style.width = hServices.offsetWidth + 15 + 'px';}, 50);

                // Edit services link with pop-up window
                // Plus at top/bottom for new users
            }/*}}}*/
        }
    }; /*}}}*/

    usersReq.send('mode=0');
}/*}}}*/
/*}}}*/

/* Media *//*{{{*/
function fetchMedia(kind) {/*{{{*/
    getMediaReq = createPostReq('media.cgi', false);

    getMediaReq.onreadystatechange = function() {/*{{{*/
        if (this.readyState ==4 && this.status == 200) {
            switch(this.responseText) {
                case 'noauth':
                    alertNoAuth();
                    break;
                case 'notmine':
                    alertDisabled();
                    break;
                case 'badreq':
                    alert('Invalid session variable - close the panel and reopen it!');
                    break;
                case 'badmedia':
                    alert('Invalid session variable - close the panel and reopen it!');
                    break;
                default:
                    results = JSON.parse(this.responseText);
                    media[kind] = results[0];
                    media[kind[0] + 'Series'] = results[1];
                    media[kind[0] + 'Genres'] = results[2];
                    media[kind + 'Genres'] = results[3];
                    keys = Object.keys(media[kind]);
                    arr = [];
                    for (k = 0; k < keys.length; k++) {
                        arr.push(media[kind][keys[k]]);
                    }
                    if (kind != 'tv') {
                        arr.sort(function(a, b) {return (a.title > b.title) ? 1 : -1;});
                    } else {
                        arr.sort(function(a, b) {
                            if (a.series == b.series) {
                                if (a.season == b.season) {
                                    return (a.episode > b.episode) ? 1 : -1;
                                } else {return (a.season > b.season) ? 1 : -1;}
                            } else {
                                return (media['tSeries'][a.series].name > media['tSeries'][b.series].name) ? 1 : -1;
                            }
                        });
                    }
                    media[kind] = arr;
                    break;
            }
        }
    };/*}}}*/

    getMediaReq.send('mode=0&media=' + kind);
}/*}}}*/

function addFilter(filter, value, mediaPanel, kind) {/*{{{*/
    filters = JSON.parse(mediaPanel.getAttribute('data-filters'));
    filters = filters.filter(function(f) {return f[0] != filter;});
    filters.push([filter, value]);
    mediaPanel.setAttribute('data-filters', JSON.stringify(filters));
    filterMedia(kind, filters);
    mediaGrid = mediaPanel.getElementsByClassName('media_grid')[0];
    updateMediaGrid(mediaGrid);
}/*}}}*/

function removeFilter(filter, mediaPanel, kind) {/*{{{*/
    filters = JSON.parse(mediaPanel.getAttribute('data-filters'));
    filters = filters.filter(function(f) {return f[0] != filter;});
    mediaPanel.setAttribute('data-filters', JSON.stringify(filters));
    filterMedia(kind, filters);
    mediaGrid = mediaPanel.getElementsByClassName('media_grid')[0];
    updateMediaGrid(mediaGrid);
}/*}}}*/

function filterMedia(kind, filters) {/*{{{*/
    items = media[kind];
    for (i = 0; i < items.length; i++) {
        m = items[i];
        keep = true;
        for (f = 0; f < filters.length; f++) {
            filter = filters[f];
            if ((filter[0] == 'dmin' && m['duration'] < filter[1]) ||
              (filter[0] == 'dmax' && m['duration'] > filter[1]) ||
              (filter[0] == 'ymin' && m['year'] < filter[1]) ||
              (filter[0] == 'ymax' && m['year'] > filter[1]) ||
              (filter[0] == 'title' && m['title'].toLowerCase().indexOf(filter[1].toLowerCase()) == -1 && (!m['series'] || (m['series'] && media[kind[0] + 'Series'][m['series']].name.toLowerCase().indexOf(filter[1].toLowerCase()) == -1)))) {
                keep = false;
                break;
            } else if (filter[0] == 'genres') {
                found = 0;
                for (g = 0; g < filter[1].length; g++) {
                    if (media[kind + 'Genres'][m.id]['genres'].indexOf(filter[1][g]) != -1) {found = 1; break;}
                }
                keep = found;
                if (!keep) {break;}
            }
        }
        document.getElementById('media_item' + i).setAttribute('data-keep', keep);
    }
}/*}}}*/

function openMediaPanel(mediaPanel, kind) {/*{{{*/
    deleteAllChildren(mediaPanel, true);
    mediaPanel.style.display = 'none';

    fetchMedia(kind);
    
    // Default time
    minTime = 1;
    maxTime = 120;

    // Filter criteria
    filterPanel = element('div');
    filterPanel.className = 'media_filter';

    // Label/*{{{*/
    filterTitle = element('p');
    filterTitle.className = 'normal_section_header';
    filterTitle.style.marginTop = '15px';
    filterTitle.style.marginLeft = '10px';
    filterTitle.style.marginBottom = '5px';
    setText(filterTitle, 'Search criteria');
    filterPanel.appendChild(filterTitle);
    filterPanel.appendChild(element('br'));/*}}}*/

    // Duration/*{{{*/
    durationText1 = element('p');
    durationText1.className = 'normal_text';
    durationText1.style.display = 'inline';
    setText(durationText1, 'Between\u00a0');
    durationInput1 = element('input');
    durationInput1.style.width = '50px';
    durationInput1.type = 'number';
    durationInput1.value = 1;
    durationInput1.min = 1;
    durationInput1.onblur = function() {this.value = verifyNum(this.value, 1, 9999);};
    durationInput1.setAttribute('data-kind', kind);
    durationInput1.onchange = function() {/*{{{*/
        minTime = parseInt(this.value, 10);
        if (!minTime || 1 > minTime) {return;}
        addFilter('dmin', minTime, this.parentElement.parentElement, this.getAttribute('data-kind'));
    };/*}}}*/
    durationText2 = element('p');
    durationText2.className = 'normal_text';
    durationText2.style.display = 'inline';
    setText(durationText2, '\u00a0and\u00a0');
    durationInput2 = element('input');
    durationInput2.style.width = '50px';
    durationInput2.type = 'number';
    durationInput2.value = 999;
    durationInput2.min = 2;
    durationInput2.onblur = function() {this.value = verifyNum(this.value, 2, 9999);};
    durationInput2.setAttribute('data-kind', kind);
    durationInput2.onchange = function() {/*{{{*/
        maxTime = parseInt(this.value, 10);
        if (!maxTime || 1 > minTime) {return;}
        addFilter('dmax', maxTime, this.parentElement.parentElement, this.getAttribute('data-kind'));
    };/*}}}*/
    durationText3 = element('p');
    durationText3.className = 'normal_text';
    durationText3.style.display = 'inline';
    setText(durationText3, '\u00a0minutes');
    filterPanel.appendChild(durationText1);
    filterPanel.appendChild(durationInput1);
    filterPanel.appendChild(durationText2);
    filterPanel.appendChild(durationInput2);
    filterPanel.appendChild(durationText3);
    filterPanel.appendChild(element('br'));
    filterPanel.appendChild(element('br'));/*}}}*/

    // Released/*{{{*/
    releaseText1 = element('p');
    releaseText1.className = 'normal_text';
    releaseText1.style.display = 'inline';
    setText(releaseText1, 'Released between\u00a0');
    releaseInput1 = element('input');
    releaseInput1.style.width = '50px';
    releaseInput1.type = 'number';
    releaseInput1.value = 1900;
    releaseInput1.min = 1900;
    releaseInput1.onblur = function() {this.value = verifyNum(this.value, 1900, 9999);};
    releaseInput1.setAttribute('data-kind', kind);
    releaseInput1.onchange = function() {/*{{{*/
        minYear = parseInt(this.value, 10);
        if (!minYear || 1 > minYear) {return;}
        addFilter('ymin', minYear, this.parentElement.parentElement, this.getAttribute('data-kind'));
    };/*}}}*/
    releaseText2 = element('p');
    releaseText2.className = 'normal_text';
    releaseText2.style.display = 'inline';
    setText(releaseText2, '\u00a0and\u00a0');
    releaseInput2 = element('input');
    releaseInput2.style.width = '50px';
    releaseInput2.type = 'number';
    releaseInput2.value = 1900 + new Date().getYear();
    releaseInput2.min = 1901;
    releaseInput2.onblur = function() {this.value = verifyNum(this.value, 1901, 9999);};
    releaseInput2.setAttribute('data-kind', kind);
    releaseInput2.onchange = function() {/*{{{*/
        maxYear = parseInt(this.value, 10);
        if (!maxYear || 1 > maxYear) {return;}
        addFilter('ymax', maxYear, this.parentElement.parentElement, this.getAttribute('data-kind'));
    };/*}}}*/
    filterPanel.appendChild(releaseText1);
    filterPanel.appendChild(releaseInput1);
    filterPanel.appendChild(releaseText2);
    filterPanel.appendChild(releaseInput2);/*}}}*/

    // Genre/*{{{*/
    genreP = element('p');
    genreP.className = 'normal_text';
    setText(genreP, 'Genres:');
    filterPanel.appendChild(genreP);
    genreKeys = Object.keys(media[kind[0] + 'Genres']);
    genreKeys.sort(function(a,b) {return media[kind[0] + 'Genres'][a].name.localeCompare(media[kind[0] + 'Genres'][b].name);});
    for (g = 0; g < genreKeys.length; g++) {/*{{{*/
        genre = media[kind[0] + 'Genres'][genreKeys[g]];
        check = element('input');
        check.type = 'checkbox';
        check.value = genre.id;
        check.setAttribute('data-kind', kind);
        check.onclick = function() {
            genre = parseInt(this.value, 10);
            filters = JSON.parse(this.parentElement.parentElement.getAttribute('data-filters'));
            genres = filters.filter(function(e) {return e[0] == 'genres';});
            if (genres.length) {genres = genres[0][1];}
            if (!genres.length) {
                genres = [genre];
            } else {
                if (genres.indexOf(genre) != -1) {
                    genres.splice(genres.indexOf(genre), 1);
                } else {
                    genres.push(genre);
                }
            }

            if (genres.length) {
                addFilter('genres', genres, this.parentElement.parentElement, this.getAttribute('data-kind'));
            } else {
                removeFilter('genres', this.parentElement.parentElement, this.getAttribute('data-kind'));
            }
        };
        checkP = element('p');
        checkP.className = 'normal_text';
        checkP.style.display = 'inline';
        setText(checkP, '\u00a0' + genre.name);

        if (useNightTheme()) {switchToNight(checkP, check);}
        filterPanel.appendChild(check);
        filterPanel.appendChild(checkP);
        filterPanel.appendChild(element('br'));
    }/*}}}*//*}}}*/

    if (useNightTheme()) {/*{{{*/
        switchToNight(
            filterTitle,
            durationText1, durationInput1, durationText2, durationInput2, durationText3,
            releaseText1, releaseInput1, releaseText2, releaseInput2,
            genreP
        );
    }/*}}}*/

    // Title search bar/*{{{*/
    titlePanel = element('div');
    titlePanel.className = 'media_title_filter';
    titleFilter = element('input');
    titleFilter.type = 'text';
    titleFilter.className = 'filter';
    titleFilter.value = 'Search titles....';
    titleFilter.onclick = function() {if (this.value == 'Search titles....') {this.value = '';}};
    titleFilter.onblur = function() {if (this.value == '') {this.value = 'Search titles....';}};
    titleFilter.setAttribute('data-kind', kind);
    titleFilter.onkeydown = function() {/*{{{*/
        if (this.getAttribute('data-lastvalue') === this.value) return;
        filters = JSON.parse(this.parentElement.parentElement.getAttribute('data-filters'));
        found = 0;
        if (filters.filter(function(e) {return e[0] == 'title'})) {found = 1;}
        if ((this.value == '' || this.value == 'Search titles....') && !found) {return};
        this.setAttribute('data-lastvalue', this.value);
        if (this.value != 'Search titles....') {
            filters = JSON.parse(mediaPanel.getAttribute('data-filters'));
            filters = filters.filter(function(f) {return f[0] != filter;});
            mediaPanel.setAttribute('data-filters', JSON.stringify(filters));
            addFilter('title', this.value, this.parentElement.parentElement, this.getAttribute('data-kind'));
        } else {
            removeFilter('title', this.parentElement.parentElement, this.getAttribute('data-kind'));
        }
    };/*}}}*/
    clearTitle = element('img');
    clearTitle.src = 'images/x.png';
    clearTitle.onclick = function() {/*{{{*/
        titleFilter = this.previousElementSibling;
        if (titleFilter.value === 'Search titles....') {return;}
        titleFilter.value = '';
        titleFilter.onblur();
        titleFilter.onchange();
    };/*}}}*/

    titlePanel.appendChild(titleFilter);
    titlePanel.appendChild(clearTitle); /*}}}*/

    mediaGrid = element('div');
    mediaGrid.className = 'media_grid';

    if (useNightTheme()) {switchToNight(filterPanel, titleFilter, mediaGrid);}
    mediaPanel.appendChild(filterPanel);
    mediaPanel.appendChild(titlePanel);
    mediaPanel.appendChild(mediaGrid);
    mediaPanel.style.display = 'block';

    // Resize elements to fit on screen/*{{{*/
    titlePanel.style.left = filterPanel.offsetLeft + filterPanel.offsetWidth + 10 + 'px';
    titlePanel.style.width = mediaPanel.offsetWidth - titlePanel.offsetLeft - 20 + 'px';
    mediaGrid.style.left = filterPanel.offsetLeft + filterPanel.offsetWidth + 10 + 'px';
    mediaGrid.style.top = titlePanel.offsetTop + titlePanel.offsetHeight + 'px';
    mediaGrid.style.width = mediaPanel.offsetWidth - titlePanel.offsetLeft + 30 + 'px';
    // - 40 is for pages
    mediaGrid.style.height = filterPanel.offsetHeight - titlePanel.offsetTop - titlePanel.offsetHeight - 40 + 5 + 'px';/*}}}*/

    pageContainer = element('div');
    pageContainer.id = 'media_pages';
    pageContainer.style.width = mediaGrid.offsetWidth + 'px';
    pageContainer.style.left = mediaGrid.offsetLeft + 'px';
    pageContainer.style.top = mediaGrid.offsetTop + mediaGrid.offsetHeight + 5 + 'px';
    mediaGrid.parentElement.appendChild(pageContainer);

    setTimeout(function() {populateMediaGrid(mediaGrid, media[kind], kind);}, 100);
}/*}}}*/

function populateMediaGrid(mediaGrid, items, kind) {/*{{{*/
    deleteAllChildren(mediaGrid, true);
    count = 0;
    lastTop = 0;
    for (m = 0; m < items.length; m++) {/*{{{*/
        item = items[m];
        container = element('span');
        container.id = 'media_item' + m;
        container.className = 'media_item';
        container.setAttribute('data-keep', true);

        // Media poster/*{{{*/
        poster = element('img');
        poster.src = 'thumbs/' + item['ttid'] + '.jpg';
        poster.style.width = '100px';
        poster.style.height = '150px';
        poster.title = item.title;
        poster.alt = item.title;
        poster.setAttribute('data-kind', kind);
        poster.setAttribute('data-item', JSON.stringify(item));
        poster.onclick = function() {
            openMediaDetails(this.parentElement.parentElement, this.getAttribute('data-kind'), JSON.parse(this.getAttribute('data-item')));
        }/*}}}*/

        // Media title/*{{{*/
        title = element('p');
        title.className = 'media_title';
        title.setAttribute('data-kind', kind);
        title.setAttribute('data-item', JSON.stringify(item));
        setText(title, item.title + ' (' + item.year + ')');
        title.onclick = function() {
            openMediaDetails(this.parentElement.parentElement, this.getAttribute('data-kind'), JSON.parse(this.getAttribute('data-item')));
        }/*}}}*/

        // Media series/*{{{*/
        series = 0;
        if (item.series) {
            series = element('p');
            series.className = 'media_series';
            setText(series, media[kind[0] + 'Series'][item.series].name);
            series.onclick = function() {
                titleFilter = this.parentElement.parentElement.parentElement.getElementsByClassName('media_title_filter')[0].getElementsByTagName('input')[0];
                titleFilter.value = this.innerText;
                titleFilter.onchange();
            };
        }/*}}}*/

        // If series, display season and episode/*{{{*/
        if (kind == 'tv') {
            season = item.season;
            //if (10 > season) {season = '0' + season;}
            ep = item.episode;
            //if (10 > ep) {ep = '0' + ep;}
            episode = element('p');
            episode.className = 'media_length';
            setText(episode, 'Season ' + season + ', Episode ' + ep)
        }/*}}}*/

        // Media length/*{{{*/
        length = element('p');
        length.className = 'media_length';
        setText(length, item['duration']+ ' minutes');/*}}}*/
        
        if (useNightTheme()) {
            switchToNight(title, length);
        }

        // Add media elements/*{{{*/
        container.appendChild(poster);
        container.appendChild(element('br'));
        container.appendChild(title);
        container.appendChild(element('br'));
        if (series) {
            if (useNightTheme()) {switchToNight(series);}
            container.appendChild(series);
            container.appendChild(element('br'));
        }
        if (kind == 'tv') {
            if (useNightTheme()) {switchToNight(episode);}
            container.appendChild(episode);
            container.appendChild(element('br'));
        }
        container.appendChild(length);

        mediaGrid.appendChild(container);/*}}}*/

        // Fix row heights to ensure proper alignments/*{{{*/
        largestHeight = 0;
        // For each new row
        if (container.offsetTop != lastTop && count) {
            for (c = mediaGrid.childElementCount - count; c < mediaGrid.childElementCount; c++) {
                mediaHeight = mediaGrid.children[c].offsetHeight;
                if (mediaHeight > largestHeight) {largestHeight = mediaHeight;}
            }
            for (c = mediaGrid.childElementCount - count - 1; c < mediaGrid.childElementCount; c++) {
                mediaGrid.children[c].style.height = largestHeight + 'px';
            }
            count = 1;
        } else {
            // Otherwise move to next item in row
            count++;
        }

        lastTop = container.offsetTop;/*}}}*/
    }/*}}}*/

    // Set up pagination
    mediaGrid.setAttribute('data-page', 1);
    mediaGrid.setAttribute('data-count', items.length);
    visibleHeight = mediaGrid.offsetHeight;
    gridWidth = 0;
    gridHeight = 0;
    // Get width of grid
    for (m = 0; m < items.length; m++) {
        e = document.getElementById('media_item' + m);
        // If item is in row 2
        if (e.offsetTop > 100) {
            gridWidth = m;
            break;
        }
    }

    // Find grid height
    for (m = gridWidth; m < items.length; m += gridWidth) {
        e = document.getElementById('media_item' + m);
        if (e.offsetTop > (visibleHeight * 3)) {
            gridHeight = m / gridWidth;
            break;
        }
    }

    // Hide extra media items, also count pages
    pages = 1;
    for (m = gridWidth * gridHeight; m < items.length; m++) {
        e = document.getElementById('media_item' + m);
        e.style.display = 'none';
        if (m % (gridWidth * gridHeight) == 0) pages++;
    }
    mediaGrid.setAttribute('data-gridsize', gridWidth * gridHeight);
    mediaGrid.setAttribute('data-pages', pages);

    pageContainer = document.getElementById('media_pages');
    prevButton = element('img');
    prevButton.className = 'prev_page';
    prevButton.style.width = pageContainer.offsetHeight * 1.25 + 'px';
    prevButton.style.height = pageContainer.offsetHeight * 1.25 + 'px';
    pageContainer.appendChild(prevButton);
    pageCount = 6;
    if (pages < 5) pageCount = pages;
    for (i = 1; i < pageCount; i++) {
        pageLink = element('a');
        setText(pageLink, i);
        pageLink.className = 'normal_text media_page';
        if (useNightTheme()) switchToNight(pageLink);
        // Set first page as selected
        if (i === 1) pageLink.className += ' page_selected';
        pageContainer.appendChild(pageLink);
        pageContainer.appendChild(document.createTextNode('\u00a0\u00a0\u00a0'));
    }

    if (pages < 6) {
        dots = element('span');
        dots.className = 'normal';
        dots.style.fontSize = '1.25em';
        setText(dots, '...\u00a0\u00a0\u00a0');
        pageContainer.appendChild(dots);
        lastPage = element('a');
        setText(lastPage, pages);
        lastPage.className = 'normal_text media_page';
        pageContainer.appendChild(lastPage);
    }

    nextButton = element('img');
    nextButton.className = 'next_page';
    nextButton.style.width = pageContainer.offsetHeight * 1.25 + 'px';
    nextButton.style.height = pageContainer.offsetHeight * 1.25 + 'px';

    if (useNightTheme()) switchToNight(nextButton, prevButton, dots, lastPage);
    pageContainer.appendChild(nextButton);
}/*}}}*/

// Updates page text in footer
function updatePages(mediaGrid) { /*{{{*/
    pages = mediaGrid.getAttribute('data-pages');
    page = mediaGrid.getAttribute('data-page');
    
    newPages = [];
    // If on first two pages
    if (page < 3) {
        // And there are 5 pages, just add 1-5
        if (pages >= 5)
            newPages = [1, 2, 3, 4, 5, pages];
        // Otherwise 1 to N
        else {
            for (i = 1; i <= pages; i++) newPages.push(i);
            newPages.push(pages);
        }
    // For everything else
    } else {
        // If not near end, just add two before/after
        if (pages - page > 2)
            newPages = [page - 2, page - 1, page, page + 1, page + 2, pages];
        // Otherwise add 5 at end
        else {
            for (i = pages - 4; i <= pages; i++) newPages.push(i);
            newPages.push(pages);
        }
    }

    pageLinks = document.getElementById('media_pages').getElementsByTagName('a');
    for (i = 0; i < pageLinks.length; i++) {
        setText(pageLinks[i], newPages[i]);
    }
} /*}}}*/

// Updates media items to match current filter
function updateMediaGrid(mediaGrid) { /*{{{*/
    gridSize = mediaGrid.getAttribute('data-gridsize');
    pages = mediaGrid.getAttribute('data-pages');
    itemCount = mediaGrid.getAttribute('data-count');

    matches = 0;
    for (i = 0; i < itemCount; i++) {
        e = document.getElementById('media_item' + i);
        if (!e.getAttribute('data-keep')) continue;
        matches++;
        if (matches > gridSize) e.style.display = 'none';
        else e.style.display = 'inline';
    }

    mediaGrid.setAttribute('data-pages', Math.ceil(matches / gridSize));
    mediaGrid.setAttribute('data-page', 1);
    updatePages(mediaGrid);
} /*}}}*/

function updatePage(mediaGrid) {
    // TODO this
    updatePages(mediaGrid);
}

function openMediaDetails(mediaGrid, kind, item) {/*{{{*/
    deleteAllChildren(mediaGrid, true);

    // Back arrow/*{{{*/
    back = element('img');
    back.style.width = '50px';
    back.style.height = '35px';
    back.src = 'images/back.png';
    back.title = 'Back';
    back.alt = 'Back';
    back.setAttribute('data-kind', kind);
    back.onclick = function() {
        filters = JSON.parse(this.parentElement.parentElement.getAttribute('data-filters'));
        items = filterMedia(kind, filters);
        populateMediaGrid(this.parentElement, items, this.getAttribute('data-kind'));
    };/*}}}*/

    // Media poster/*{{{*/
    poster = element('img');
    poster.style.cssFloat = 'right';
    poster.style.marginTop = '10px';
    poster.style.marginRight = '20px';
    poster.src = 'thumbs/' + item.ttid + '.jpg';
    poster.title = item.title;
    poster.alt = item.title;
    poster.style.width = '200px';
    poster.style.height = '300px';/*}}}*/

    // Media title/*{{{*/
    titleLink = element('a');
    titleLink.className = 'normal_text';
    titleLink.href = 'http://www.imdb.com/title/tt' + item.ttid + '/';
    titleLink.title = '(To IMDb - hold control while clicking to open in new tab)';
    titleLink.targetNew = 'tab';
    titleLink.target = '_blank';
    title = element('p');
    title.className = 'normal_section_header';
    title.style.textDecoration = 'underline';
    title.style.display = 'inline-block';
    title.style.position = 'relative';
    title.style.left = '20px';
    title.style.top = '-7px';
    setText(title, item.title);
    titleLink.appendChild(title);/*}}}*/
        
    // Media series/*{{{*/
    if (item.series) {
        series = element('p');
        series.className = 'media_series';
        series.style.position = 'relative';
        series.style.fontSize = '100%';
        setText(series, 'Part\u00a0of\u00a0\u00a0&lt;' + media[kind[0] + 'Series'][item.series].name + '&gt;');
        if (useNightTheme()) {switchToNight(series);}
    }/*}}}*/

    // If TV episode, add season/episode to series/*{{{*/
    if (kind == 'tv') {
        episode = element('p');
        episode.className = 'media_length';
        episode.style.display = 'inline';
        episode.style.fontSize = '100%';
        setText(episode, ':\u00a0Season\u00a0' + item.season + ',\u00a0Episode\u00a0' + item.episode);
        if (useNightTheme()) {switchToNight(episode);}
        series.appendChild(episode);
    }/*}}}*/

    // Info labels/*{{{*/
    detailLabels = element('div');
    detailLabels.style.cssFloat = 'left';
    detailLabels.style.textAlign = 'right';
    detailLabels.style.marginLeft = '10px';
    labels = element('p');
    labels.style.className = 'normal_text';
    l = 'Genre:<br>Released on:<br>Running time:';
    if (item['director']) {
        l += '<br>Directed by:';
    }
    setText(labels, l);
    detailLabels.appendChild(labels);/*}}}*/

    // Info values/*{{{*/
    detailValues = element('div');
    detailValues.style.cssFloat = 'left';
    details = element('p');
    genres = media[kind + 'Genres'][item.id]['genres'];
    genreNames = [];
    for (g = 0; g < genres.length; g++) {
        genreNames.push(media[kind[0] + 'Genres'][genres[g]].name);
    }
    genreNames.sort();
    str = '\u00a0\u00a0' + genreNames.join(', ') + '<br>\u00a0\u00a0' + item.released + '<br>\u00a0\u00a0' + item.duration + ' minutes';
    if (item['director']) {
        str += '<br>\u00a0\u00a0' + item.director;
    }
    setText(details, str);
    detailValues.appendChild(details);/*}}}*/

    // Description/*{{{*/
    descriptionTitle = element('p');
    descriptionTitle.className = 'normal_section_header';
    descriptionTitle.style.clear = 'left';
    descriptionTitle.style.cssFloat = 'left';
    descriptionTitle.style.marginLeft = '10px';
    setText(descriptionTitle, 'Short description (may contain spoilers)');

    descriptionBox = element('div');
    descriptionBox.className = 'outline';
    descriptionBox.style.clear = 'left';
    descriptionBox.style.cssFloat = 'left';
    descriptionBox.style.marginLeft = '10px';
    descriptionBox.style.paddingLeft = '10px';
    descriptionBox.style.paddingRight = '10px';
    descriptionBox.style.width = mediaGrid.offsetWidth - 200 - 80 + 'px';
    showText = element('p');
    setText(showText, 'Click to show description');
    showText.onclick = function() {
        this.style.display = 'none';
        this.nextElementSibling.style.display = 'block';
    };

    description = element('p');
    description.style.display = 'none';
    setText(description, item.description);
    descriptionBox.appendChild(showText);
    descriptionBox.appendChild(description);/*}}}*/

    // Technical details/*{{{*/
    techLink = element('a');
    techLink.href = '#';
    techLink.className = 'normal_text';
    techLink.style.clear = 'left';
    techLink.style.cssFloat = 'left';
    techLink.style.marginLeft = '10px';
    techLink.onclick = function() {
        techLabels.style.display = 'block';
        techValues.style.display = 'block';
        this.style.display = 'none';
        tVals.style.marginTop = (tLabels.offsetTop - tVals.offsetTop) + 'px';
    };
    setText(techLink, '<br>Show technical details');

    techLabels = element('div');
    techLabels.style.cssFloat = 'left';
    techLabels.style.clear = 'left';
    techLabels.style.textAlign = 'right';
    techLabels.style.marginLeft = '10px';
    techLabels.style.display = 'none';
    tLabels = element('p');
    tLabels.style.className = 'normal_text';
    setText(tLabels, 'Resolution:<br>File size:<br>Video codec:<br>Video FPS:<br>Video bitrate:<br>Audio codec:<br>Channels:<br>Audio rate:<br>SHA512 checksum:');

    techValues = element('div');
    techValues.style.cssFloat = 'left';
    techValues.style.display = 'none';
    tVals = element('p');
    tVals.className = 'normal_text';
    tVals.style.marginTop = '0px';
    sep = '<br>\u00a0\u00a0';
    vrate = parseSize(item['v_rate'])[0];
    if (vrate !== 'Unknown') vrate += '/s';
    arate = parseSize(item['a_rate'])[0];
    if (arate !== 'Unknown') arate += '/s';
    checksum = item['checksum'].substr(0, 64) + sep + item['checksum'].substr(64, 64);
    setText(tVals, '\u00a0\u00a0' + [item['resolution'], parseSize(item['size'])[0], item['v_codec'], item['fps'], vrate, item['a_codec'], item['channels'], arate, checksum].join(sep));

    techLabels.appendChild(tLabels);
    techValues.appendChild(tVals);/*}}}*/

    // Download/*{{{*/
    downloadButton = element('button');
    setText(downloadButton, 'Download');
    downloadButton.style.cssFloat = 'left';
    downloadButton.style.clear = 'left';
    downloadButton.style.marginLeft = '10px';
    downloadButton.style.marginTop = '10px';
    downloadButton.setAttribute('data-kind', kind);
    downloadButton.setAttribute('data-item', JSON.stringify(item));
    downloadButton.onclick = function() {/*{{{*/
        i = JSON.parse(this.getAttribute('data-item'));
        first_dl = 0;
        if (!document.getElementById('dl_list')) {first_dl = 1;}
        getFile(i.file, this.getAttribute('data-kind'), i);
        if (!first_dl) {
            addDownloadPopup(this.parentElement);
        }
    };/*}}}*/

    subButton = element('button');
    if (item.has_subtitle) {/*{{{*/
        setText(subButton, 'Download subtitles');
        subButton.style.cssFloat = 'left';
        subButton.style.marginLeft = '10px';
        subButton.style.marginTop = '10px';
    }/*}}}*//*}}}*/

    // Add elements/*{{{*/
    if (useNightTheme()) {switchToNight(title, titleLink, labels, details, techLink, tLabels, tVals, descriptionTitle, descriptionBox, downloadButton, subButton);}

    mediaGrid.appendChild(back);
    mediaGrid.appendChild(poster);
    mediaGrid.appendChild(titleLink);
    mediaGrid.appendChild(element('br'));
    if (item.series) {
        mediaGrid.appendChild(series);
        series.style.top = '-10px';
        series.style.left = title.offsetLeft + 'px';
        mediaGrid.appendChild(element('br'));
    }
    mediaGrid.appendChild(detailLabels);
    mediaGrid.appendChild(detailValues);
    mediaGrid.appendChild(descriptionTitle);
    mediaGrid.appendChild(descriptionBox);
    mediaGrid.appendChild(techLink);
    mediaGrid.appendChild(techLabels);
    mediaGrid.appendChild(techValues);
    mediaGrid.appendChild(downloadButton);
    if (item.has_subtitle) {mediaGrid.appendChild(subButton);}
    /*}}}*/
}/*}}}*/

/* File download stuff */ /*{{{*/
function addFAPIEventListeners(f) {/*{{{*/
    f.addEventListener('onstatusupdate', function(e) {/*{{{*/
        fAPI = this.target;
        if (fAPI.failed) {
            alert('Download of ' + fAPI.title + ' failed - ' + fAPI.status);
            document.getElementById(fAPI.ttid + '_pause').style.display = 'none';
            document.getElementById(fAPI.ttid + '_up').style.display = 'none';
            document.getElementById(fAPI.ttid + '_down').style.display = 'none';
        } else {
            setText(document.getElementById(fAPI.ttid + '_status'), fAPI.status);
        }

        if (fAPI.status === 'Decrypting') {fAPI.decryptStatus(fAPI, 0);}
        console.log(CryptoJS.MD5(fAPI.sessionID).toString() + ' - Status: ' + e.target.status);
    });/*}}}*/
    f.addEventListener('onprogressupdate', function(e) {/*{{{*/
        fAPI = this.target;
        bar = document.getElementById(fAPI.ttid + '_progress');
        w = parseInt(bar.getAttribute('data-width'), 10);
        h = parseInt(bar.getAttribute('data-height'), 10);
        c = parseInt(bar.getAttribute('data-curve'), 10);
        s = parseInt(bar.getAttribute('data-stroke'), 10);
        ctx = bar.getContext('2d');
        updateProgressBar(ctx, w, h, c, s, fAPI.progress);
        updateInfo(document.getElementById(fAPI.ttid + '_info'), fAPI);
        if (fAPI.status !== 'Decrypting') {console.log(CryptoJS.MD5(fAPI.sessionID).toString() + ' - Progress: ' + fAPI.progress * 100 + '%, ' + parseSize(fAPI.chunkSpeed)[0]);}
    });/*}}}*/
    f.addEventListener('oncomplete', function(e) {/*{{{*/
        fAPI = this.target;
        cl = 'normal_text';
        if (useNightTheme()) {cl += ' night';}
        setText(document.getElementById(fAPI.ttid + '_status'), '');
        dl = element('a');
        dl.href = fAPI.dataURI;
        dl.className = cl;
        dl.download = fAPI.file;
        dl.fAPI = fAPI;
        setText(dl, 'Download');
        dl.onclick = function() {setTimeout(this.fAPI.clean, 1000);}
        document.getElementById(fAPI.ttid + '_status').appendChild(dl);
    });/*}}}*/
}/*}}}*/

function getFile(file, kind, item) {/*{{{*/
    if (document.getElementById(item.ttid)) {
        switchTab('dl');
        return;
    }
    
    f = FileAPI();
    f.ttid = item.ttid;
    f.title = item.title;
    addFAPIEventListeners(f);

    addDownload(f, item);

    if (document.getElementById('dl_list').childElementCount <= MAX_DL) {
        f.initialize(file, kind);
    }

}/*}}}*/

function getStubs() {/*{{{*/
    req = createPostReq('/file.cgi', false);
    req.send('s=4');
    data = trim(req.responseText)
    data = data.split('#;#');
    if (!data.length || data[0] === '') {return;}
    for (i = 0; i < data.length; i++) {
        stub = FileAPIStub();
        stub.populate(JSON.parse(data[i]));
        fAPI = stub.toFAPI();
        r = createPostReq('/file.cgi', false);
        r.send('s=5&si=' + fAPI.sessionID + '&o=' + fAPI.chunks);

        addDownload(fAPI, {'title': fAPI.title, 'ttid': fAPI.ttid, 'size': fAPI.size});
        addFAPIEventListeners(fAPI);
    }
}/*}}}*/

function populateDL(dlPanel, firstSize, transferSize) {/*{{{*/
    title = element('p');
    title.id = 'dl_title';
    title.className = 'normal_section_header';
    title.style.marginTop = '5px';
    title.style.marginBottom = '5px';
    setText(title, 'Downloads');

    stats = element('p');
    stats.id = 'dl_stats';
    stats.className = 'normal_text';
    stats.style.fontWeight = 'bold';
    stats.style.fontSize = '90%';

    queuedDL = 1;
    queuedSize = firstSize;
    queuedTSize = transferSize;
    updateDLStats(stats);

    downloadList = element('div');
    downloadList.id = 'dl_list';
    downloadList.className = 'media_grid';
    downloadList.style.position = 'absolute';
    downloadList.style.width = '95%';

    if (useNightTheme()) {switchToNight(title, stats, downloadList);}
    dlPanel.appendChild(title);
    dlPanel.appendChild(stats);
    dlPanel.appendChild(downloadList);
    setTimeout(function() {downloadList.style.height = /*{{{*/
                            document.getElementById('main').offsetHeight - 
                            document.getElementById('dl_stats').offsetTop - 
                            document.getElementById('dl_stats').offsetHeight - 40 + 'px';
                          }, 10);/*}}}*/
}/*}}}*/

function addDownload(fAPI, item) {/*{{{*/
    if (!document.getElementById('dl_list')) {/*{{{*/
        // Create download tab
        downloadPanel = element('div');
        downloadPanel.id = 'dl';
        downloadTab = element('div');
        setText(downloadTab, 'Downloads');
        downloadTab.setAttribute('data-id', 'dl');
        downloadTab.onclick = function() {switchTab(this.getAttribute('data-id'));}
        addTab(downloadPanel, downloadTab);

        populateDL(downloadPanel, item.size, item.size * 1.3578);
        downloadPanel.style.height = main.offsetHeight + 'px';

        switchTab('dl');/*}}}*/
    } else {/*{{{*/
        queuedDL++;
        queuedSize += item.size;
        queuedTSize += (1.3578 * item.size);
        updateDLStats();
    }/*}}}*/

    list = document.getElementById('dl_list');
    dl = element('div');
    dl.id = item.ttid;
    dl.className = 'dl_item outline';

    // Poster/*{{{*/
    poster = element('img');
    poster.src = 'thumbs/' + item.ttid + '.jpg';
    poster.style.cssFloat = 'left';
    poster.style.width = '135px';
    poster.style.height = '200px';
    poster.style.marginTop = '12.5px';
    poster.style.marginLeft = '10px';
    /*}}}*/

    // Title/*{{{*/
    title = element('p');
    title.className = 'normal_text';
    title.style.position = 'relative';
    title.style.left = '10px';
    title.style.top = '20px';
    title.style.fontWeight = 'bold';
    setText(title, item.title);/*}}}*/

    // Progress bar/*{{{*/
    width = 350;
    height = 15;
    curve = 25;
    stroke = 4;

    progress = element('canvas');
    progress.id = item.ttid + '_progress';
    progress.setAttribute('data-width', width);
    progress.setAttribute('data-height', height);
    progress.setAttribute('data-curve', curve);
    progress.setAttribute('data-stroke', stroke);
    progress.width = width;
    progress.height = height;
    progress.style.marginLeft = '10px';
    progress.style.marginTop = '10px';

    ctx = progress.getContext('2d');

    updateProgressBar(ctx, width, height, curve, stroke, 0);
    /*}}}*/

    // Status /*{{{*/
    stat = element('p');
    stat.id = item.ttid + '_status';
    stat.className = 'normal_text';
    stat.style.display = 'inline';
    stat.style.marginLeft = '15px';
    setText(stat, fAPI.status);/*}}}*/

    // Action buttons/*{{{*/
    pause = createActionButton('pause', 0);
    pause.id = item.ttid + '_pause';
    pause.fAPI = fAPI;
    if (fAPI.paused) {
        pause.style.display = 'none';
    } else {
        pause.style.display = 'block';
    }
    pause.onclick = function() {this.fAPI.pause(); document.getElementById(this.id.replace('_pause', '_play')).style.display = 'block'; this.style.display = 'none'};
    play = createActionButton('play', 0);
    play.id = item.ttid + '_play';
    play.fAPI = fAPI;
    if (fAPI.paused) {
        play.style.display = 'block';
    } else {
        play.style.display = 'none';
    }
    play.onclick = function() {this.fAPI.pause(); document.getElementById(this.id.replace('_play', '_pause')).style.display = 'block'; this.style.display = 'none'};
    remove = createActionButton('remove', 0);
    remove.id = item.ttid + '_remove';
    remove.fAPI = fAPI;
    remove.size = item.size;
    remove.onclick = function() {/*{{{*/
        this.fAPI.clean();
        this.parentElement.remove();
        queuedDL--;
        queuedSize -= this.size;
        queuedTSize -= (this.size * 1.3578);
        updateDLStats();
    }/*}}}*/
    down = createActionButton('down', 0);
    down.id = item.ttid + '_down';
    up = createActionButton('up', 0);
    up.id = item.ttid + '_up';/*}}}*/
    
    // Info/*{{{*/
    info = element('p');
    info.id = item.ttid + '_info';
    info.className = 'normal_text';
    info.style.position = 'relative';
    info.style.left = '10px';

    updateInfo(info, fAPI);/*}}}*/

    if (useNightTheme()) {switchToNight(dl, title, info, stat);}

    // Add elements/*{{{*/
    dl.appendChild(poster);
    dl.appendChild(title);
    dl.appendChild(element('br'));
    dl.appendChild(progress);
    dl.appendChild(stat);
    dl.appendChild(up);
    dl.appendChild(down);
    dl.appendChild(remove);
    dl.appendChild(pause);
    dl.appendChild(play);
    dl.appendChild(element('br'));
    dl.appendChild(info);
    list.appendChild(dl);/*}}}*/
}/*}}}*/

function addDownloadPopup(mgrid) {/*{{{*/
    bubble = document.createElement('span');
    bubble.className = 'dl_popup';
    bubble.style.opacity = '0';
    setText(bubble, 'Download added');
    mgrid.appendChild(bubble);
    bubble.style.left = (mgrid.offsetWidth - 200 - bubble.offsetWidth) / 2 + 'px';
    bubble.style.top = (mgrid.offsetHeight - bubble.offsetHeight) / 2 + 'px';
    fade(bubble, 1);
}/*}}}*/

function fade(bubble, dir) {/*{{{*/
    o = parseFloat(bubble.style.opacity, 10);
    if (dir) {
        o += .05;
    } else {
        o -= .05;
    }
    bubble.style.opacity = o;

    if (o == 1) {
        setTimeout(function() {fade(bubble, 0);}, 1500);
    } else if (o == 0) {
        bubble.parentElement.removeChild(bubble);
    } else {
        setTimeout(function() {fade(bubble, dir);}, 60);
    }
}/*}}}*/

function updateDLStats(stats) {/*{{{*/
    if (!stats) {stats = document.getElementById('dl_stats');}
    setText(stats, 'Queued:\u00a0' + queuedDL + stringFill('\u00a0', 4) +
                   'File size:\u00a0' + parseSize(queuedSize)[0] + stringFill('\u00a0', 4) +
                   'Transfer size:\u00a0' + parseSize(queuedTSize)[0]);
}/*}}}*/

function updateProgressBar(ctx, width, height, curve, stroke, percent) {/*{{{*/
    ctx.clearRect(0, 0, width, height);
    g = ctx.createLinearGradient(0, height, width, 0);
    g.addColorStop('0', '#AAAAAA');
    g.addColorStop('.15', '#8C85AA');
    g.addColorStop('.65', '#7766AA');
    g.addColorStop('.95', '#6655AA');
    ctx.lineWidth = stroke;
    ctx.strokeStyle = g;

    traceCurvedRect(ctx, width, height, curve, stroke, 1);
    ctx.stroke();
    
    ctx.fillStyle = g;
    traceCurvedRect(ctx, width, height, curve, stroke, percent);
    ctx.fill();
}/*}}}*/

function updateInfo(elem, fAPI) {/*{{{*/
    size = parseInt(fAPI.size, 10);
    if (!size) {size = '0 MB';}
    else {size = parseSize(size)[0];}
    speed = (parseInt(fAPI.chunkSpeed, 10) + parseInt(fAPI.avgSpeed, 10)) / 2;
    if (!speed) {
        received = '0';
        rate = ['-- KB/s'];
        eta = '-- minutes';
    } else {
        received = parseSize(parseInt(fAPI.received), 10)[0];
        rate = parseSize(speed)[0] + '/s';
        eta = (parseInt(fAPI.size, 10) - parseInt(fAPI.received, 10)) / speed;
        eta = parseTime(eta)[0];
    }

    d = new Date();
    if (!fAPI.startedAt) {
        d = '';
    } else {
        d.setTime(fAPI.startedAt);
    }

    receiveText = 'Received:\u00a0\u00a0';/*{{{*/
    prefix = '';
    if (fAPI.status === 'Decrypting') {
        prefix = '\u00a0';
        received = fAPI.chunksDecrypted;
        size = fAPI.chunks;
        receiveText = 'Decrypted:\u00a0\u00a0';
        eta = fAPI.decryptETA;
    }/*}}}*/

    setText(elem, /*{{{*/
        prefix + 'Started at:\u00a0\u00a0' + 
            d.toString().split(/ [A-Z]{3}/)[0].
                replace(/ /, ', ').
                replace(/( [A-Za-z]+) ([0-9]{2})/, ' $2$1').
                replace(/([0-9]{4})/, '$1,') + '\u00a0<br>' + 
        receiveText + received + '\u00a0/\u00a0' + size + '\u00a0<br>' +
        prefix + stringFill('\u00a0', 5) + 'Speed:\u00a0\u00a0' + rate + '\u000a<br>' +
        prefix + stringFill('\u00a0', 2) + 'Time left:\u00a0\u00a0' + eta
   );/*}}}*/
}/*}}}*/

function createActionButton(symbol, hover) {/*{{{*/
    length = 30;
    btn = element('canvas');
    btn.width = length;
    btn.height = length;
    btn.style.display = 'inline';
    btn.style.cssFloat = 'right';
    btn.style.marginRight = '15px';
    btn.setAttribute('data-symbol', symbol);
    btn.onmouseover = function() {drawActionButton(this, this.getAttribute('data-symbol'), 1);}
    btn.onmouseout = function() {drawActionButton(this, this.getAttribute('data-symbol'), 0);}

    drawActionButton(btn, symbol, hover);
    return btn;
}/*}}}*/

function drawActionButton(btn, symbol, hover) {/*{{{*/
    ctx = btn.getContext('2d');
    color = '#6655AA';
    border = '#888888';
    back = '#AAAAAA';
    if (hover) {
        color = '#CFCFCF';
    }
    drawSquare(ctx, length, back, border);

    ctx.lineWidth = 4;
    ctx.beginPath();
    if (symbol == 'pause') {/*{{{*/
        ctx.moveTo(10, 7.5);
        ctx.lineTo(10, 22.5);
        ctx.moveTo(20, 7.5);
        ctx.lineTo(20, 22.5);/*}}}*/
    } else if (symbol == 'play') {
        ctx.moveTo(10, 7.5);
        ctx.lineTo(20, 14.5);
        ctx.lineTo(10, 22.5);
        ctx.closePath();
    } else if (symbol == 'remove') {/*{{{*/
        ctx.moveTo(7.5, 7.5);
        ctx.lineTo(22.5, 22.5);
        ctx.moveTo(22.5, 7.5);
        ctx.lineTo(7.5, 22.5);/*}}}*/
    } else if (symbol == 'down') {/*{{{*/
        ctx.moveTo(15, 5.5);
        ctx.lineTo(15, 22.5);
        ctx.moveTo(15.5, 25);
        ctx.lineTo(7.5, 15);
        ctx.moveTo(15, 5.5);
        ctx.lineTo(15, 22.5);
        ctx.moveTo(14.5, 25);
        ctx.lineTo(22.5, 15);/*}}}*/
    } else if (symbol == 'up') {/*{{{*/
        ctx.moveTo(15, 25);
        ctx.lineTo(15, 5.5);
        ctx.moveTo(15.5, 5.25);
        ctx.lineTo(7.5, 15);
        ctx.moveTo(15, 25);
        ctx.lineTo(15, 5.5);
        ctx.moveTo(14.5, 5.25);
        ctx.lineTo(22.5, 15);
    }/*}}}*/
    ctx.strokeStyle = color;
    ctx.stroke();
}/*}}}*/

function traceCurvedRect(ctx, width, height, curve, stroke, percentage) {/*{{{*/
    if (percentage == 0) {ctx.beginPath(); ctx.moveTo(0, 0); ctx.moveTo(1, 1); ctx.closePath(); return;}

    percentWidth = width * (1 - percentage);
    adjWidth = width - stroke / 2;
    adjHeight = height - stroke / 2;
    rightCurve = adjWidth - curve;
    leftCurve = curve + stroke / 2;
    bottomCurve = adjWidth - percentWidth;
    if (bottomCurve < stroke) {bottomCurve = stroke;}
    topCurve = rightCurve - percentWidth;
    if (topCurve < stroke) {topCurve = stroke;}

    ctx.beginPath();
    ctx.moveTo(stroke / 2, height / 2);
    ctx.quadraticCurveTo(0, 0, leftCurve, stroke / 2);
    ctx.lineTo(topCurve, stroke / 2);
    ctx.quadraticCurveTo(width - percentWidth, 0, bottomCurve, height / 2);
    ctx.quadraticCurveTo(width - percentWidth, height, topCurve, adjHeight);
    ctx.lineTo(leftCurve, adjHeight);
    ctx.quadraticCurveTo(0, height, stroke / 2, height / 2);
    ctx.closePath();
}/*}}}*/

function drawSquare(ctx, length, fill, stroke) {/*{{{*/
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.lineTo(length, length);
    ctx.lineTo(0, length);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill()

    width = 3;
    ctx.moveTo(width / 2, width / 2);
    ctx.lineTo(length - width / 2, width / 2);
    ctx.lineTo(length - width / 2, length - width / 2);
    ctx.lineTo(width / 2, length - width / 2);
    ctx.lineTo(width / 2, width / 2);
    ctx.strokeStyle = stroke;
    ctx.stroke();
}/*}}}*/ /*}}}*/

function openVideos() {/*{{{*/
    videoPanel = element('div');
    id = 'videos_' + new Date().getTime();
    videoPanel.id = id;
    videoPanel.className = 'videos';
    videoPanel.style.display = 'none';
    videoPanel.setAttribute('data-filters', JSON.stringify([]));

    // Add tab/*{{{*/
    videoTab = element('div');
    videoTab.className = 'tab';
    setText(videoTab, 'Videos');
    videoTab.setAttribute('data-id', id);
    videoTab.onclick = function() {switchTab(this.getAttribute('data-id'));}
    addTab(videoPanel, videoTab);
    videoPanel.style.display = 'block';
    switchTab(id);/*}}}*/

    openMediaPanel(videoPanel, 'movies');
}/*}}}*/

function openTV() {/*{{{*/
    tvPanel = element('div');
    id = 'tv_' + new Date().getTime();
    tvPanel.id = id;
    tvPanel.className = 'tv';
    tvPanel.style.display = 'none';
    tvPanel.setAttribute('data-filters', JSON.stringify([]));

    // Add tab/*{{{*/
    tvTab = element('div');
    tvTab.className = 'tab';
    setText(tvTab, 'TV');
    tvTab.setAttribute('data-id', id);
    tvTab.onclick = function() {switchTab(this.getAttribute('data-id'));}
    addTab(tvPanel, tvTab);
    tvPanel.style.display = 'block';
    switchTab(id);/*}}}*/

    openMediaPanel(tvPanel, 'tv');
}/*}}}*/
/*}}}*/
