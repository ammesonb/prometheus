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
    notesEditor.setAttribute('data-note_id', -1);
    notesEditor.className = 'notes_editor';
    notes.appendChild(notesEditor);

    // Create table to display notes in
    notesTable = document.createElement('table');
    notesTable.className = 'notes';

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
        noteID = editPane.getAttribute('data-note_id');
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

        saveReq = new XMLHttpRequest();

        saveReq.onreadystatechange = function() {
            if (saveReq.readyState == 4 && saveReq.status == 200) {
                status = saveReq.responseText;

                if (status == 'success') {
                } else if (status == 'none') {
                    setText(errorText, 'Update failed - no matching note found!');
                } else if (status == 'fail') {
                    setText(errorText, 'Failed to create new note!');
                } else if (status == 'extra') {
                    setText(errorText, 'Update succeeded, but found multiple matching notes!');
                } else if (status == 'expired') {
                    alert('Session has expired! Please save any modified data locally and reload the page.');
                } else if (status == 'badid') {
                    setText(errorText, 'Update failed - no matching note found!');
                } else if (status == 'baddata') {
                    setText(errorText, 'Update failed - invalid data in title or text field!');
                }
            }
        };

        saveReq.open('POST', 'notes.cgi', false);
        saveReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        saveReq.send('mode=1&note_id=' + noteID +
                     '&note_title=' + encodeURIComponent(noteTitle) + '&note_text=' + encodeURIComponent(noteText));

        if (saveReq.responseText === 'expired') {return;}
        // Delay update for one second
        setTimeout(function() {
            updateReq = new XMLHttpRequest();
    
            updateReq.onreadystatechange = function() {
                if (updateReq.readyState == 4 && updateReq.status == 200) {refreshNotes(updateReq.responseText);}
            };
    
            updateReq.open('POST', 'notes.cgi', true);
            updateReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            updateReq.send('mode=0');
        }, 1000);
    }

    cancelButton = document.createElement('button');
    cancelButton.className = 'left_action';
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() {
        tab = this.parentElement.parentElement.children[0];
        table = 0;
        for (child = 0; child < tab.children.length; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        for (child = 0; child < table.children.length; child++) {table.children[child].style.textDecoration = 'none';}

        this.parentElement.setAttribute('data-note_id', -1);
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
        for (child = 0; child < table.children.length; child++) {table.children[child].style.textDecoration = 'none';}

        this.parentElement.setAttribute('data-note_id', -1);
        c = this.parentElement.children;
        for (child = 0; child < c.length; child++) {
            if (c[child].tagName == 'INPUT' || c[child].tagName == 'TEXTAREA') {c[child].value = '';}
            if (c[child].className == 'error_text') {setText(c[child], '');}
        }
    };

    errorText = document.createElement('p');
    errorText.className = 'error_text';

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

        // If no note loaded, but title and text match, this note must have just been created
        if (notesEditor.getAttribute('data-note_id') == '-1' &&
            note.title == editorTitleText && note.text == editorNoteText) {
            notesEditor.setAttribute('data-note_id', note.id);
            r.style.textDecoration = 'underline';
        }

        r.onclick = function() {
            editNote(JSON.parse(this.getAttribute('data-note')), this);
            children = this.parentElement.children;
            for (child = 0; child < children.length; child++) {
                children[child].style.textDecoration = 'none';
            }
            this.style.textDecoration = 'underline';
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
        setText(title, note.title);
        mtime = document.createElement('td');
        setText(mtime, note.mtime);
        a = document.createElement('a');
        a.href = '#';
        a.style.float = 'right';
        a.style.paddingRight = '5px';
        i = document.createElement('img');
        i.src = 'images/x.png';
        i.alt = 'Delete note';
        i.title = 'Delete note';
        a.appendChild(i);
        a.setAttribute('data-note_id', note.id);
        a.setAttribute('data-note_title', note.title);
        a.onclick = function() {
            confirmDelete = confirm('Are you sure you want to delete note \'' + this.getAttribute('data-note_title') + '\'?');
            if (!confirmDelete) {return;}
            deletedNoteID = this.getAttribute('data-note_id');
            deleteReq = new XMLHttpRequest();
            
            deleteReq.onreadystatechange = function() {
                if (deleteReq.readyState == 4 && deleteReq.status == 200) {
                    refreshReq = new XMLHttpRequest();

                    refreshReq.onreadystatechange = function() {
                        if (refreshReq.readyState == 4 && refreshReq.status == 200) {
                            if (notesEditor.getAttribute('data-note_id') == deletedNoteID) {
                                notesEditor.setAttribute('data-note_id', -1);
                                for (child = 0; child < notesEditor.children.length; child++) {
                                    elem = notesEditor.children[child];
                                    if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
                                }
                            }
                            refreshNotes(refreshReq.responseText);
                        }
                    }

                    refreshReq.open('POST', 'notes.cgi', true);
                    refreshReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    refreshReq.send('mode=0');
                    // Do something
                    // Probably refreshNotes - make notes.cgi return updated list of notes, possibly tie into mode 0?
                }
            };

            deleteReq.open('POST', 'notes.cgi', true);
            deleteReq.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            deleteReq.send('mode=2&note_id=' + this.getAttribute('data-note_id'));
        }
        mtime.appendChild(a);

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
        titleTD.style.width = titleTD.offsetWidth + 10 + 'px';
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
    editPane.setAttribute('data-note_id', note.id);
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
            noteEditor.setAttribute('data-note_id', -1);
            for (child = 0; child < noteEditor.children.length; child++) {
                elem = noteEditor.children[child];
                if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
            }
        }

        populateNotes(notes, noteTable, noteEditor, 0);
    }
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
            accountPanel.appendChild(serviceP);

            // If account isn't shared, show password box
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
                p = document.createElement('p');
                p.style.display = 'inline-block';
                p.style.textAlign = 'right';
                p.style.paddingTop = '0px';
                p.style.paddingBottom = '0px';
                p.style.marginTop = '0px';
                p.style.marginBottom = '0px';

                error_p = document.createElement('p');
                error_p.id = 'pass_error_' + id;
                error_p.className = 'error';
                error_p.style.paddingTop = '0px';
                error_p.style.paddingBottom = '0px';
                error_p.style.marginTop = '0px';
                error_p.style.marginBottom = '0px';
                setText(error_p, '\u00a0');

                // Inputs
                p1 = document.createElement('input');
                p1.type = 'password';
                p1.id = 'pass_' + id;
                p1.setAttribute('data-button_id', 'update_pass_' + id);
                p1.setAttribute('data-other_input_id', 'pass_verify_' + id);
                p1.setAttribute('data-error_id', 'pass_error_' + id);
                p2 = document.createElement('input');
                p2.id = 'pass_verify_' + id;
                p2.type = 'password';
                p2.setAttribute('data-button_id', 'update_pass_' + id);
                p2.setAttribute('data-other_input_id', 'pass_' + id);
                p2.setAttribute('data-error_id', 'pass_error_' + id);

                p1.onkeyup = function() {
                    b = document.getElementById(this.getAttribute('data-button_id'));
                    if (this.value == '' || this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other_input_id')).value) {
                        b.disabled = false;

                    } else {
                        b.disabled = true;
                    }
                };
                p1.onchange = function() {
                    if (this.value == '' || this.value.length < 8) {
                        if (this.value) {
                            setText(document.getElementById(this.getAttribute('data-error_id')),
                                    'Password must have at least 8 characters');
                        }
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other_input_id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error_id')), '\u00a0');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error_id')),
                                'Passwords don\'t match');
                    }
                }
                p2.onkeyup = function() {
                    b = document.getElementById(this.getAttribute('data-button_id'));
                    if (this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ==
                               document.getElementById(this.getAttribute('data-other_input_id')).value) {
                        b.disabled = false;
                    } else {
                        b.disabled = true;
                    }
                };
                p2.onchange = function() {
                    if (this.value.length >= 8 && this.value ==
                            document.getElementById(this.getAttribute('data-other_input_id')).value) {
                        setText(document.getElementById(this.getAttribute('data-error_id')), '\u00a0');
                    } else {
                        setText(document.getElementById(this.getAttribute('data-error_id')),
                                'Passwords don\'t match');
                    }
                }

                updateButton = document.createElement('button');
                updateButton.id = 'update_pass_' + id;
                updateButton.disabled = true;
                setText(updateButton, 'Update Password');

                // Add children
                p.appendChild(error_p);
                p.appendChild(document.createTextNode('Enter password:\u00a0\u00a0'));
                p.appendChild(p1);
                p.appendChild(document.createElement('br'));
                p.appendChild(document.createTextNode('Enter password again:\u00a0\u00a0'));
                p.appendChild(p2);
                p.appendChild(document.createElement('br'));
                iBox.appendChild(p);
                pBox.appendChild(iBox);
                pBox.appendChild(updateButton);

                accountPanel.appendChild(passText);
                accountPanel.appendChild(pBox);
            }

            if (accountType == 'admin') {
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
