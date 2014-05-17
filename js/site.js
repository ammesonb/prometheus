function login() {
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

    c = CryptoJS.SHA512(b.value).toString();

    f = document.createElement('form');
    f.method = 'POST';
    f.action = 'login.cgi';
    i1 = document.createElement('input');
    i1.name = 'a';
    i1.type = 'text';
    i1.value = a.value;
    i2 = document.createElement('input');
    i2.name = 'c';
    i2.type = 'password';
    i2.value = c;
    f.appendChild(i1);
    f.appendChild(i2);
    f.style.display = 'none';
    document.body.appendChild(f);
    f.submit();
}

function useNightTheme() {
    theme = document.body.getAttribute('data-night-theme');
    now = new Date();
    return ((theme == 1 && now.getHours() >= 19) || theme == 2);
}

function switchToNight() {
    for (a = 0; a < arguments.length; a++) {arguments[a].className += ' night';}
}

function setText(element, text) {
    element.innerText = text;
    element.innerHTML = text;
}

/* Tabs */
function addTab(element, tabElement) {
    tabElement.className = 'tab ' + element.id;
    tabLink = document.createElement('a');
    tabLink.href = '#';
    tabLink.appendChild(tabElement);
    x = document.createElement('img');
    x.src = 'images/x.png';
    x.alt = 'Close tab';
    x.title = 'Close tab';
    x.setAttribute('data-id', element.id);
    x.onclick = function() {
        closeTab(this.getAttribute('data-id'));
    };
    setText(tabElement, tabElement.innerText + '\u00a0');
    tabElement.appendChild(x);
    document.getElementById('tabs').appendChild(tabLink);
    document.getElementById('main').appendChild(element);
}

function closeTab(tabID) {
    switchTab('home');
    document.getElementById(tabID).remove();
    document.getElementsByClassName(tabID)[0].remove();
}

function switchTab(tabID) {
    if (!document.getElementById(tabID)) {return;}

    oldTab = document.getElementsByClassName('selected')[0];
    if (oldTab.id == tabID) {return;}
    oldTab.style.display = 'none';
    oldTab.className = oldTab.className.replace('selected', '').trim();
    newTab = document.getElementById(tabID);
    newTab.style.display = 'inline-block';
    newTab.className = newTab.className + ' selected';
}

/* Notes */
function openNotes() {
    // Create notes panel
    notes = document.createElement('div');
    id = 'notes' + new Date().getTime();
    notes.id = id;
    notes.className = 'notes';
    notes.style.display = 'none';

    notesList = document.createElement('div');
    notesList.className = 'notes_list';
    notes.appendChild(notesList);

    notesEditor = document.createElement('div');
    notesEditor.setAttribute('data-note-id', -1);
    notesEditor.className = 'notes_editor';
    notes.appendChild(notesEditor);

    // Create table to display notes in
    notesTable = document.createElement('table');
    notesTable.className = 'notes';
    if (useNightTheme()) {notesTable.className += ' night';}

    headerRow = document.createElement('tr');
    tableTitle = document.createElement('th');
    setText(tableTitle, 'Title');
    tableMTime = document.createElement('th');
    setText(tableMTime, 'Last Modified');
    headerRow.appendChild(tableTitle);
    headerRow.appendChild(tableMTime);
    notesTable.appendChild(headerRow);

    notesList.appendChild(notesTable);

    // Create editor pane
    titleDesc = document.createElement('p');
    titleDesc.className = 'form_label';
    setText(titleDesc, 'Title:');

    noteTitle = document.createElement('input');
    noteTitle.className = 'note_title';
    noteTitle.type = 'text';
    noteTitle.name = 'title';

    textDesc = document.createElement('p');
    textDesc.className = 'form_label';
    setText(textDesc, 'Note:');

    noteText = document.createElement('textarea');
    noteText.className = 'note_editor';
    noteText.name = 'text';

    saveButton = document.createElement('button');
    saveButton.className = 'left_action';
    setText(saveButton, 'Save');
    saveButton.onclick = function() {
        editPane = this.parentElement;
        noteID = editPane.getAttribute('data-note-id');
        noteTitle = '';
        noteText = '';
        errorText = 0;
        c = editPane.children;

        for (child= 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT') {
                noteTitle = c[child].value;
            } else if (c[child].tagName == 'TEXTAREA') {
                noteText = c[child].value;
            } else if (c[child].className == 'error_text') {
                errorText = c[child];
            }
        }
        setText(errorText, '');

        if (noteTitle.length === 0) {
            setText(errorText, 'You must enter a title');
            return;
        } else if (noteText.length === 0) {
            setText(errorText, 'You must enter a note');
            return;
        }

        saveNoteReq = new XMLHttpRequest();

        saveNoteReq.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                status = this.responseText;

                switch(status) {
                    case 'success':
                        setText(errorText, '\u00a0');
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
                        alert('You tried to edit something not belonging to you! This account has been disabled!');
                        break;
                }
            }
        };

        saveNoteReq.open('POST', 'notes.cgi', false);
        saveNoteReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        saveNoteReq.send('mode=1&note_id=' + noteID +
                     '&note_title=' + encodeURIComponent(noteTitle) + '&note_text=' + encodeURIComponent(noteText));

        if (saveNoteReq.responseText === 'expired') {return;}

        // Delay update for one second
        setTimeout(function() {
            updateNoteReq = new XMLHttpRequest();
    
            updateNoteReq.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {refreshNotes(this.responseText);}
            };
    
            updateNoteReq.open('POST', 'notes.cgi', true);
            updateNoteReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            updateNoteReq.send('mode=0');
        }, 1000);
    };

    cancelButton = document.createElement('button');
    cancelButton.className = 'left_action';
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() {
        tab = this.parentElement.parentElement.children[0];
        table = 0;
        for (child = 0; child < tab.children.length; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length != 0) {
            underlines = document.getElementsByClassName('note_edit');
            for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
        }

        this.parentElement.setAttribute('data-note-id', -1);
        c = this.parentElement.children;
        for (child = 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT' || c[child].tagName == 'TEXTAREA') {c[child].value = '';}
            if (c[child].className == 'error_text') {setText(c[child], '');}
        }
    };

    createButton = document.createElement('button');
    createButton.className = 'right_action';
    createButton.style.marginRight = '10px';
    setText(createButton, 'Create note');
    createButton.onclick = function() {
        tab = this.parentElement.parentElement.children[0];
        table = 0;
        for (child = 0; child < tab.children.length; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length != 0) {
            underlines = document.getElementsByClassName('note_edit');
            for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
        }

        this.parentElement.setAttribute('data-note-id', -1);
        c = this.parentElement.children;
        for (child = 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT' || c[child].tagName == 'TEXTAREA') {c[child].value = '';}
            if (c[child].className == 'error_text') {setText(c[child], '');}
        }
    };

    errorText = document.createElement('p');
    errorText.className = 'error_text';

    if (useNightTheme()) {
        switchToNight(noteTitle, textDesc, noteText, saveButton, cancelButton, createButton);
    }

    notesEditor.appendChild(titleDesc);
    notesEditor.appendChild(noteTitle);
    notesEditor.appendChild(document.createElement('br'));
    notesEditor.appendChild(textDesc);
    notesEditor.appendChild(noteText);
    notesEditor.appendChild(saveButton);
    notesEditor.appendChild(cancelButton);
    notesEditor.appendChild(errorText);
    notesEditor.appendChild(createButton);

    // Fetch notes
    req = new XMLHttpRequest();

    req.onreadystatechange = function() {
        if (req.readyState == 4 && req.status == 200) {populateNotes(req.responseText, notesTable, notesEditor, 1);}
    }

    req.open('POST', 'notes.cgi', true);
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    req.send('mode=0');

    // Create actual note tab
    noteTab = document.createElement('div');
    setText(noteTab, 'Notes');
    noteTab.className = 'tab';
    noteTab.setAttribute('data-id', id);
    noteTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(notes, noteTab);
    switchTab(id);
}

function populateNotes(data, notesTable, notesEditor, resize) {
    if (data == 'noauth') {window.location.reload(true);}

    // Else
    // Get current editor state
    editorTitleText = '';
    editorNoteText = '';
    for (child = 0; child < notesEditor.children.length; child++) {
        editorElem = notesEditor.children[child];
        if (editorElem.tagName == 'INPUT') {editorTitleText = editorElem.value;}
        if (editorElem.tagName == 'TEXTAREA') {editorNoteText = editorElem.value;}
    }

    notes = JSON.parse(data);
    for (n = 0; n < notes.length; n++) {
        note = notes[n];
        r = document.createElement('tr');
        r.setAttribute('data-note', JSON.stringify(note));

        // Select appropriate note
        // If no note loaded, but title and text match, this note must have just been created
        selected = 0;
        if (notesEditor.getAttribute('data-note-id') == '-1' &&
            note.title == editorTitleText && note.text == editorNoteText) {
            notesEditor.setAttribute('data-note-id', note.id);
            selected = 1;
        // Otherwise if current note is in editor
        } else if (notesEditor.getAttribute('data-note-id') == note.id) {
            selected = 1;
        }

        r.onclick = function() {
            editNote(JSON.parse(this.getAttribute('data-note')), this);

            // Since just doing it once doesn't seem to be enough....
            while (document.getElementsByClassName('note_edit').length != 0) {
                underlines = document.getElementsByClassName('note_edit');
                for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
            }
            underlines = this.getElementsByTagName('u');
            for (u = 0; u < underlines.length; u++) {
                underlines[u].className = 'note_edit';
                if (useNightTheme()) {switchToNight(underlines[u]);}
            }
        }
        r.onmouseover = function() {
            this.style.fontWeight = 'bold';
            this.style.fontStyle = 'italic';
        }
        r.onmouseout = function() {
            this.style.fontWeight = 'normal';
            this.style.fontStyle = 'normal';
        }

        title = document.createElement('td');
        title.style.paddingRight = '5px';
        title.style.maxWidth = notesTable.clientWidth * .3 + 'px';
        title.style.wordWrap = 'break-word';
        titleUnderline = document.createElement('u');
        titleUnderline.className = 'note_blank';
        if (selected) {
            titleUnderline.className = 'note_edit';
            if (useNightTheme()) {switchToNight(titleUnderline);}
        }
        titleText = document.createElement('span');
        titleText.className = 'normal';
        setText(titleText, note.title);
        titleUnderline.appendChild(titleText);
        title.appendChild(titleUnderline);

        mtime = document.createElement('td');
        mtimeUnderline = document.createElement('u');
        mtimeUnderline.className = 'note_blank';
        if (selected) {
            mtimeUnderline.className = 'note_edit';
            if (useNightTheme()) {switchToNight(mtimeUnderline);}
        }
        mtimeText = document.createElement('span');
        mtimeText.className = 'normal';
        setText(mtimeText, note.mtime);
        mtimeUnderline.appendChild(mtimeText);
        mtime.appendChild(mtimeUnderline);
        a = document.createElement('a');
        a.href = '#';
        a.style.float = 'right';
        a.style.paddingRight = '5px';
        i = document.createElement('img');
        i.src = 'images/x.png';
        i.alt = 'Delete note';
        i.title = 'Delete note';
        a.appendChild(i);
        a.setAttribute('data-note-id', note.id);
        a.setAttribute('data-note-title', note.title);
        a.onclick = function() {
            confirmDelete = confirm('Are you sure you want to delete note \'' + this.getAttribute('data-note-title') + '\'?');
            if (!confirmDelete) {return;}
            deletedNoteID = this.getAttribute('data-note-id');
            deleteNoteReq = new XMLHttpRequest();
            
            deleteNoteReq.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    refreshNotesReq = new XMLHttpRequest();

                    refreshNotesReq.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200) {
                            if (notesEditor.getAttribute('data-note-id') == deletedNoteID) {
                                notesEditor.setAttribute('data-note-id', -1);
                                for (child = 0; child < notesEditor.children.length; child++) {
                                    elem = notesEditor.children[child];
                                    if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
                                }
                            }
                            refreshNotes(this.responseText);
                        }
                    }

                    refreshNotesReq.open('POST', 'notes.cgi', true);
                    refreshNotesReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    refreshNotesReq.send('mode=0');
                }
            };

            deleteNoteReq.open('POST', 'notes.cgi', true);
            deleteNoteReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            deleteNoteReq.send('mode=2&note_id=' + this.getAttribute('data-note-id'));
        }
        mtime.appendChild(a);

        if (useNightTheme()) {
            switchToNight(titleText, mtimeText);
        }

        r.appendChild(title);
        r.appendChild(mtime);

        notesTable.appendChild(r);
    }

    // Resize notes text to fill height
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
    }
}

function editNote(note, row) {
    notePanel = row.parentElement.parentElement.parentElement;
    panes = notePanel.children;
    editPane = 0;
    for (pane = 0; pane < panes.length; pane++) {
        if (panes[pane].className == 'notes_editor') {
            editPane = panes[pane];
            break;
        }
    }
    editPane.setAttribute('data-note-id', note.id);
    editElems = editPane.children;
    for (elem = 0; elem < editElems.length; elem++) {
        if (editElems[elem].tagName == 'INPUT') {editElems[elem].value = note.title;}
        if (editElems[elem].tagName == 'TEXTAREA') {editElems[elem].value = note.text;}
        if (editElems[elem].className == 'error_text') {setText(editElems[elem], '');}
    }
}

function refreshNotes(notes) {
    notesPanes = document.getElementsByClassName('notes');
    for (pane = 0; pane < notesPanes.length; pane++) {
        if (notesPanes[pane].tagName != 'DIV') {continue;}

        notePane = notesPanes[pane];
        noteTable = 0;
        noteEditor = 0;
        // Get note table and note editor
        // and clear out old entries
        for (child = 0; child < notePane.children.length; child++) {
            elem = notePane.children[child];
            if (elem.className == 'notes_editor') {noteEditor = elem;}
            if (elem.className == 'notes_list') {
                noteTable = elem.children[0];

                while (noteTable.children.length > 1) {
                    row = noteTable.children[1];
                    row.remove();
                }
            }
        }

        // If this pane wasn't selected, clear out its edit panel
        if (noteTable.parentElement.parentElement.className.search('selected') == -1) {
            noteEditor.setAttribute('data-note-id', -1);
            for (child = 0; child < noteEditor.children.length; child++) {
                elem = noteEditor.children[child];
                if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
            }
        }

        populateNotes(notes, noteTable, noteEditor, 0);
    }
}

/* Tasks */
function openTasks() {
    id = 'tasks_' + new Date().getTime();
    taskPanel = document.createElement('div');
    taskPanel.id = id;

    taskTab = document.createElement('div');
    setText(taskTab, 'Task List');
    taskTab.className = 'tab';
    taskTab.setAttribute('data-id', id);
    taskTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(taskPanel, taskTab);
    switchTab(id);
}

/* Account Management */
function viewAccount() {
    id = 'my_account_' + new Date().getTime();
    accountPanel = document.createElement('div');
    accountPanel.id = id;

    privilegesReq = new XMLHttpRequest();

    privilegesReq.onreadystatechange = function() {
        if (privilegesReq.readyState == 4 && privilegesReq.status == 200) {
            data = privilegesReq.responseText;
            data = data.split(';');
            accountType = data[0];
            services = data[1];
            serviceP = document.createElement('p');
            serviceP.className = 'normal_text';
            setText(serviceP, 'You may access the following services: ' + services);
            if (useNightTheme()) {serviceP.className += ' night';}
            accountPanel.appendChild(serviceP);

            // If account isn't shared, show password box and theme
            if (accountType != 'shared') {
                passText = document.createElement('p');
                passText.className = 'normal_section_header';
                passText.style.paddingBottom = '0px';
                passText.style.marginBottom = '10px';
                setText(passText, 'Update Password');

                // Divs for alignment
                pBox = document.createElement('div');
                pBox.style.display = 'inline-block';
                pBox.style.textAlign = 'center';
                pBox.className = 'normal';
                iBox = document.createElement('div');
                iBox.style.textAlign = 'left';

                // Text
                error_p = document.createElement('p');
                error_p.id = 'pass_error_' + id;
                error_p.className = 'error';
                error_p.style.fontWeight = 'bold';
                error_p.style.paddingTop = '0px';
                error_p.style.paddingBottom = '0px';
                error_p.style.marginTop = '0px';
                error_p.style.marginBottom = '10px';
                setText(error_p, '\u00a0');

                p = document.createElement('p');
                p.style.display = 'inline-block';
                p.style.textAlign = 'right';
                p.style.paddingTop = '0px';
                p.style.paddingBottom = '0px';
                p.style.marginTop = '0px';
                p.style.marginBottom = '0px';

                // Inputs
                p1 = document.createElement('input');
                p1.type = 'password';
                p1.id = 'pass_' + id;
                p1.setAttribute('data-button-id', 'update_pass_' + id);
                p1.setAttribute('data-other-input-id', 'pass_verify_' + id);
                p1.setAttribute('data-error-id', 'pass_error_' + id);
                p2 = document.createElement('input');
                p2.id = 'pass_verify_' + id;
                p2.type = 'password';
                p2.setAttribute('data-button-id', 'update_pass_' + id);
                p2.setAttribute('data-other-input-id', 'pass_' + id);
                p2.setAttribute('data-error-id', 'pass_error_' + id);

                p1.onkeyup = function() {
                    b = document.getElementById(this.getAttribute('data-button-id'));
                    if (this.value == '' || this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        b.disabled = false;
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        b.disabled = true;
                    }
                };
                p1.onchange = function() {
                    if (this.value == '' || this.value.length < 8) {
                        if (this.value) {
                            setText(document.getElementById(this.getAttribute('data-error-id')),
                                    'Password must have at least 8 characters');
                        }
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Passwords don\'t match');
                    }
                }
                p2.onkeyup = function() {
                    b = document.getElementById(this.getAttribute('data-button-id'));
                    if (this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        b.disabled = false;
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        b.disabled = true;
                    }
                };
                p2.onchange = function() {
                    if (this.value.length >= 8 && this.value ==
                            document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else if (this.value.length < 8) {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Password must have at least 8 characters');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error-id')),
                                'Passwords don\'t match');
                    }
                }

                updateButton = document.createElement('button');
                updateButton.id = 'update_pass_' + id;
                updateButton.disabled = true;
                updateButton.setAttribute('data-pass-id', 'pass_' + id);
                updateButton.setAttribute('data-error-id', 'pass_error_' + id);
                updateButton.onclick = function() {
                    updatePassReq = new XMLHttpRequest();
                    error_id = this.getAttribute('data-error-id');

                    updatePassReq.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200) {
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
                    };
                    updatePassReq.open('POST', 'account.cgi', true);
                    updatePassReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    updatePassReq.send('mode=1&p=' +
                        CryptoJS.SHA512(document.getElementById(this.getAttribute('data-pass-id')).value));
                };
                setText(updateButton, 'Update Password');

                // Switch to night theme if appropriate
                if (useNightTheme()) {
                    switchToNight(passText, pBox, p1, p2, updateButton);
                }
        
                // Add children
                p.appendChild(document.createTextNode('Enter password:\u00a0\u00a0'));
                p.appendChild(p1);
                p.appendChild(document.createElement('br'));
                p.appendChild(document.createTextNode('Enter password again:\u00a0\u00a0'));
                p.appendChild(p2);
                p.appendChild(document.createElement('br'));
                iBox.appendChild(p);
                pBox.appendChild(error_p);
                pBox.appendChild(iBox);
                pBox.appendChild(updateButton);

                accountPanel.appendChild(passText);
                accountPanel.appendChild(pBox);

                // Theme selection shouldn't be allowed for shared accounts
                // to avoid conflict
                themeP = document.createElement('p');
                themeP.className = 'normal_text';
                setText(themeP, 'Night theme: ');
                themeS = document.createElement('select');
                themeS.setAttribute('data-error-id', 'theme_error_' + id);
                opt1 = document.createElement('option');
                opt1.value = 0;
                setText(opt1, 'Never');
                opt2 = document.createElement('option');
                opt2.value = 1;
                setText(opt2, 'After 7 PM local time');
                opt3 = document.createElement('option');
                opt3.value = 2;
                setText(opt3, 'Always');
                opts = [opt1, opt2, opt3];
                opts[document.body.getAttribute('data-night-theme')].selected = true;
                themeError = document.createElement('span');
                themeError.id = 'theme_error_' + id;
                themeError.className = 'error';
                themeError.fontWeight = 'bold';
                themeError.style.paddingLeft = '10px';
                setText(themeError, '\u00a0');
    
                themeS.onchange = function() {
                    updateThemeReq = new XMLHttpRequest();
                    error = document.getElementById(this.getAttribute('data-error-id'));
                    theme = this.value;
    
                    updateThemeReq.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200) {
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
                    };
    
                    updateThemeReq.open('POST', 'account.cgi', false);
                    updateThemeReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    updateThemeReq.send('mode=2&theme=' + this.value);
                    
                };
    
                if (useNightTheme()) {
                    switchToNight(themeP, themeS, opt1, opt2, opt3);
                }

                themeS.appendChild(opt1);
                themeS.appendChild(opt2);
                themeS.appendChild(opt3);
                themeP.appendChild(themeS);
                themeP.appendChild(themeError);
                accountPanel.appendChild(themeP);
            }
        }
    };

    privilegesReq.open('POST', 'account.cgi', false);
    privilegesReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    privilegesReq.send('mode=0');

    // Create tab and display panel
    accountTab = document.createElement('div');
    setText(accountTab, 'My Account');
    accountTab.className = 'tab';
    accountTab.setAttribute('data-id', id);
    accountTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(accountPanel, accountTab);
    switchTab(id);
}
