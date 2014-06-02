/* Global variables */
var colors = ['#FF1300', '#FF6A00', '#FFA540', '#FFD240', '#9BED00', '#37DB79', '#63ADD0', '#7872D8', '#4B5BD8', '#9A3ED5', '#7F4BA0', '#ED3B83', '#999'];
var expanded = [];
var tasks = [];
var sortedTasks = [];
var tasksByID = [];
var projects = [];
var rootProjects = [];
var subProjects = [];
var projectsByID = [];
var projectHierarchy = [];

function createPostReq(url, mode) {
    req = new XMLHttpRequest();
    req.open('POST', url, mode);
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    return req;
}

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
    i3 = document.createElement('input');
    i3.type = 'hidden';
    i3.name = 't';
    i3.value = jstz.determine().name();
    f.style.display = 'none';
    document.body.appendChild(f);
    f.submit();
}

function useNightTheme() {
    theme = document.body.getAttribute('data-night-theme');
    now = new Date();
    return ((theme == 1 && (now.getHours() >= 19 || now.getHours() < 8)) || theme == 2);
}

function switchToNight() {
    for (a = 0; a < arguments.length; a++) {arguments[a].className += ' night';}
}

function stringFill(x, n) {
    var s = '';
    for (;;) {
        if (n & 1) {s += x;}
        n >>= 1;
        if (n) {x += x;}
        else {break;}
    }
    return s;
}

function pad(text, length, fill, side) {
    if (side == 'f') {
        while (text.length < length) {text = fill + text;}
    } else if (side == 'b') {
        while (text.length < length) {text += fill;}
    }
    return text;
}

function padTime(text) {
    return pad(text, 2, '0', 'f');
}

function isIE() {
    return (css_browser_selector(navigator.userAgent).search('ie') != -1) ||
            (navigator.userAgent.search('\\) like Gecko') != -1);
}

function flatten(arr) {
    flat = new Array();
    for (i = 0; i < arr.length; i++) {
        if (arr[i]) {
            arr[i].forEach(function(e) {flat.push(e);});
        }
    }

    return flat;
}

function deleteAllChildren(elem, removeAll) {
    if (isIE()) {
        while (elem.childElementCount > 0) {elem.children[0].removeNode(true);}
    } else if (removeAll) {
        while (elem.childNodes.length) {elem.childNodes[0].remove();}
    } else {
        while (elem.childElementCount > 0) {elem.children[0].remove();}
    }
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

        saveNoteReq = createPostReq('notes.cgi', false);

        saveNoteReq.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                status = this.responseText;

                if (status == 'success') {errorText.style.color = 'green';}
                else {errorText.style.color = 'red';}

                switch(status) {
                    case 'success':
                        setText(errorText, 'Saved at ' + padTime(new Date().getHours()) + ':' + padTime(new Date().getMinutes()) + ':' + padTime(new Date().getSeconds()));
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

        saveNoteReq.send('mode=1&note_id=' + noteID +
                     '&note_title=' + encodeURIComponent(noteTitle) + '&note_text=' + encodeURIComponent(noteText));

        if (saveNoteReq.responseText === 'expired') {return;}

        // Delay update for one second
        setTimeout(function() {
            updateNoteReq = createPostReq('notes.cgi', true);
    
            updateNoteReq.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {refreshNotes(this.responseText);}
            };
    
            updateNoteReq.send('mode=0');
        }, 1000);
    };

    cancelButton = document.createElement('button');
    cancelButton.className = 'left_action';
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() {
        tab = this.parentElement.parentElement.children[0];
        table = 0;
        for (child = 0; child < tab.childElementCount; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length !== 0) {
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
        for (child = 0; child < tab.childElementCount; child++) {
            if (tab.children[child].tagName === 'TABLE') {table = tab.children[child];}
        }
        while (document.getElementsByClassName('note_edit').length !== 0) {
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
        switchToNight(notesEditor, titleDesc, noteTitle, textDesc, noteText, saveButton, cancelButton, createButton);
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
    req = createPostReq('notes.cgi', true);

    req.onreadystatechange = function() {
        if (req.readyState == 4 && req.status == 200) {populateNotes(req.responseText, notesTable, notesEditor, 1);}
    };

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
    for (child = 0; child < notesEditor.childElementCount; child++) {
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
            while (document.getElementsByClassName('note_edit').length !== 0) {
                underlines = document.getElementsByClassName('note_edit');
                for (u = 0; u < underlines.length; u++) {underlines[u].className = 'note_blank';}
            }
            underlines = this.getElementsByTagName('u');
            for (u = 0; u < underlines.length; u++) {
                underlines[u].className = 'note_edit';
                if (useNightTheme()) {switchToNight(underlines[u]);}
            }
        };
        r.onmouseover = function() {
            this.style.fontWeight = 'bold';
            this.style.fontStyle = 'italic';
        };
        r.onmouseout = function() {
            this.style.fontWeight = 'normal';
            this.style.fontStyle = 'normal';
        };

        title = document.createElement('td');
        title.style.paddingRight = '5px';
        title.style.maxWidth = notesTable.clientWidth * 0.3 + 'px';
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
        setText(mtimeText, note.mtime.split('\.')[0]);
        mtimeUnderline.appendChild(mtimeText);
        mtime.appendChild(mtimeUnderline);
        a = document.createElement('a');
        a.href = '#';
        a.style.cssFloat = 'right';
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
            deleteNoteReq = createPostReq('notes.cgi', true);
            
            deleteNoteReq.onreadystatechange = function() {
                if (this.readyState == 4 && this.status == 200) {
                    refreshNotesReq = createPostReq('notes.cgi', true);

                    refreshNotesReq.onreadystatechange = function() {
                        if (this.readyState == 4 && this.status == 200) {
                            if (notesEditor.getAttribute('data-note-id') == deletedNoteID) {
                                notesEditor.setAttribute('data-note-id', -1);
                                for (child = 0; child < notesEditor.childElementCount; child++) {
                                    elem = notesEditor.children[child];
                                    if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
                                }
                            }
                            refreshNotes(this.responseText);
                        }
                    };

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
        if (panes[pane].className.search('notes_editor') != -1) {
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
        }

        // If this pane wasn't selected, clear out its edit panel
        if (noteTable.parentElement.parentElement.className.search('selected') == -1) {
            noteEditor.setAttribute('data-note-id', -1);
            for (child = 0; child < noteEditor.childElementCount; child++) {
                elem = noteEditor.children[child];
                if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {elem.value = '';}
            }
        }

        populateNotes(notes, noteTable, noteEditor, 0);
    }
}

/* Tasks */
function switchDeadlineTimezone(d) {
    utc = 0;
    if (d.toString().search('\\\+') != -1) {
        utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    } else {
        utc = d.getTime() - (d.getTimezoneOffset() * 60000);
    }
    return new Date(utc);
}

function deadlineToDate(deadline) {
    deadline = deadline.replace('-', '/');
    deadline = deadline.replace('-', '/');
    deadline = deadline.split('+')[0];
    d = new Date(deadline);
    return d;
}

function getTimeFromString(dateString) {
    time = dateString.split(' ')[4].split(':')
    return time[0] + ':' + time[1]
}

function makeBlankTask(project) {
    newTask = new Object();
    newTask.id = -1;
    newTask.name = 'New task';
    newTask.description = '';
    newTask.priority = -1;
    newTask.project = project;
    newTask.deadline = null;
    newTask.is_urgent = true;

    return newTask;
}

function openTasks() {
    id = 'tasks_' + new Date().getTime();
    taskPanel = document.createElement('div');
    taskPanel.className = 'tasks';
    taskPanel.id = id;

    // Create panel skeleton
    // Section headers
    projectsPanel = document.createElement('div');
    projectsPanel.className = 'project_panel';
    projectsPanel.setAttribute('data-project-id', -1);

    projectsList = document.createElement('div');
    projectsList.className = 'project_list';

    // Create new project input/button
    newProject = document.createElement('span');
    newProjectName = document.createElement('input');
    newProjectName.className = 'new_project';
    newProjectName.value = 'Enter new project name';
    newProjectName.onfocus = function() {
        if (this.value === 'Enter new project name') {this.value = '';}
    };
    newProjectName.onblur = function() {
        if (this.value === '') {this.value = 'Enter new project name';}
    };
    saveNewProject = document.createElement('a');
    saveNewProject.className = 'save_project';
    saveNewProject.href = '#';
    saveNewProject.onclick = function() {
        list = this.parentElement.parentElement.getElementsByClassName('project_list')[0];
        nameElem = this.previousSibling;
        if (name === 'Enter new project name') {return;}

        saveProjReq = createPostReq('tasks.cgi', true);

        saveProjReq.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                switch(this.responseText) {
                    case 'success':
                        nameElem.value = 'Enter new project name';

                        fetchTaskData();
                        populateProjects(list);

                        break;
                    default:
                        alert('Failed to create project!');
                        break;
                }
            }
        };

        saveProjReq.send('mode=1&name=' + nameElem.value + '&parent=' + projectsPanel.getAttribute('data-project-id'));
    };
    setText(saveNewProject, '+');
    newProject.appendChild(newProjectName);
    newProject.appendChild(saveNewProject);

    // Upcoming panel
    upcoming = document.createElement('div');
    upcoming.className = 'task_view';
    upcoming.setAttribute('project_level', 0);

    upcomingU = document.createElement('u');
    upcomingU.className = 'note_edit';
    upcomingP = document.createElement('p');
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
    taskPanel.appendChild(upcoming);
    
    fetchTaskData();
    populateProjects(projectsList);
    populateUpcoming(upcoming);

    // Add tab and panel
    taskTab = document.createElement('div');
    setText(taskTab, 'Task List');
    taskTab.className = 'tab';
    taskTab.setAttribute('data-id', id);
    taskTab.onclick = function() {switchTab(this.getAttribute('data-id'));};
    addTab(taskPanel, taskTab);
    switchTab(id);

    // Position the new project elements
    newProject.style.position = 'absolute';
    newProject.style.top = projectsPanel.offsetTop + projectsPanel.offsetHeight - newProject.offsetHeight - 5 + 'px';
    newProject.style.width = projectsPanel.offsetWidth - 5 + 'px';
    newProjectName.style.width = newProject.offsetWidth - saveNewProject.offsetWidth - 10 + 'px';
    saveNewProject.style.left = newProjectName.offsetLeft + newProjectName.offsetWidth + 3 + 'px';
    saveNewProject.style.top = newProjectName.offsetTop + (0.5 * newProjectName.offsetHeight - (0.5 * saveNewProject.offsetHeight)) + 1 + 'px';

    // Check if task wraps by comparing offsettops through DOM
    spans = upcoming.getElementsByTagName('span');
    // For each set of tasks (urgent, normal, other)
    for (s = 0; s < spans.length; s++) {
        span = spans[s];
        // For each task/header in them
        for (pNum = 0; pNum < span.childElementCount; pNum++) {
            p = span.children[pNum];
            // Eliminate headers
            if (p.className.search('normal_text') === -1) {continue;}
            offset = p.children[0].offsetTop;
            breakLine = 0;
            // For each of their children
            for (cNum = 1; cNum < p.childElementCount; cNum++) {
                c = p.children[cNum];
                childBreakFound = 0
                // If it has children (some do, some don't)
                if (c.childElementCount) {
                    for (c2Num = 0; c2Num < c.childElementCount; c2Num++) {
                        c2 = c.children[c2Num];
                        if (c2.offsetTop > offset) {
                            childBreakFound = 1;
                            break;
                        }
                    }
                }

                if (childBreakFound || c.offsetTop > offset) {
                    breakLine = 1;
                    break;
                }
            }

            if (breakLine) {
                if (span.children[pNum + 1]) {
                    span.insertBefore(document.createElement('br'), span.children[pNum + 1]);
                } else {
                    span.appendChild(document.createElement('br'));
                }
            }
        }
    }
}

function openProject(taskView, project) {
    deleteAllChildren(taskView, 1);

    // Display current project tree
    taskView.parentElement.children[0].setAttribute('data-project-id', project.id);
    c = 'black';
    if (useNightTheme()) {c = 'silver';}
    projLinks = createProjectLinks(project.id, c, 1, 1);
    addProjectLinks(projLinks, c, taskView, true);

    // Delete project button
    removeProjectLink = document.createElement('a');
    removeProjectLink.className = 'blank';
    removeProjectLink.href = '#';
    removeProjectLink.setAttribute('data-project-id', project.id);
    removeProjectLink.setAttribute('data-project-name', project.name);
    removeProjectLink.onclick = function() {
        deleteProject(this.getAttribute('data-project-id'), 'project', taskView);
    };
    removeProjectImg = document.createElement('img');
    removeProjectImg.src = 'images/x.png';
    removeProjectImg.alt = 'Remove project';
    removeProjectImg.title = 'Remove project';
    removeProjectLink.appendChild(document.createTextNode('\u00a0\u00a0'));
    removeProjectLink.appendChild(removeProjectImg);

    taskView.appendChild(removeProjectLink);

    // Create subproject list
    if (subProjects[project.id]) {
        subProjects[project.id].sort(function(a, b) {return a.name > b.name;});
        subprojectsP = document.createElement('p');
        subprojectsP.style.className = 'normal_text';
        tmpP = document.createElement('p');
        tmpP.className = 'normal_text';
        tmpP.style.fontSize = '120%';
        tmpP.style.marginBottom = '0px';
        setText(tmpP, 'Subprojects:');
        if (useNightTheme()) {switchToNight(tmpP);}
        subprojectsP.appendChild(tmpP);
        tmpP = document.createElement('p');
        tmpP.className = 'normal_text';
        tmpP.style.fontSize = '120%';
        tmpP.style.display = 'inline';
        setText(tmpP, '\u00a0\u00a0\u00a0');
        subprojectsP.appendChild(tmpP);
        for (subp = 0; subp < subProjects[project.id].length; subp++) {
            subpr = subProjects[project.id][subp];
            subpA = document.createElement('a');
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
                tmpP = document.createElement('p');
                tmpP.className = 'normal_text';
                tmpP.style.display = 'inline';
                setText(tmpP, ',\u00a0');
                if (useNightTheme()) {switchToNight(tmpP);}
                subprojectsP.appendChild(tmpP);
            }
        }
    
        if (useNightTheme()) {switchToNight(subprojectsP);}
    
        taskView.appendChild(subprojectsP);
    } else {
        taskView.appendChild(document.createElement('br'));
        taskView.appendChild(document.createElement('br'));
    }

    // Get task list
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
    otherTasks = out[6];

    // Add new task button
    newTaskP = document.createElement('p');
    newTaskP.style.display = 'inline';
    newTaskP.style.cssFloat = 'right';
    newTaskP.style.marginBottom = '2px';
    newTaskButton = document.createElement('button');
    newTaskButton.setAttribute('this-project-id', project.id);
    newTaskButton.onclick = function() {
        openTask(makeBlankTask(this.getAttribute('this-project-id')), taskView, 'project');
    }
    setText(newTaskButton, 'Create task');
    newTaskP.appendChild(newTaskButton);

    if (useNightTheme()) {switchToNight(newTaskButton);}

    taskView.appendChild(newTaskP);

    // If no tasks, add whitespace
    if (urgent.length == 0 && other.length == 0 && normal.length == 0) {
        taskView.appendChild(document.createElement('br'));
        taskView.appendChild(document.createElement('br'));
    }

    addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks);

    return;

    // Show project's tasks - legacy, leaving for reference
    // Add new task button
    newTaskButton = document.createElement('button');
    newTaskButton.onclick = function() {
        openTask(makeBlankTask(project.id), taskView);
    }
    setText(newTaskButton, 'Create task');

    if (useNightTheme()) {switchToNight(newTaskButton);}

    // If no subprojects, need an extra two line
    if (!subProjects[project.id]) {
        taskView.appendChild(document.createElement('br'));
        taskView.appendChild(document.createElement('br'));
    }
    taskView.appendChild(newTaskButton);
    taskView.appendChild(document.createElement('br'));

    // Order tasks alphabetically then by urgent, normal, other
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
    }

    // Add tasks table
    if (myTasks.length > 0) {
        taskView.appendChild(document.createElement('br'));

        tasksTable = document.createElement('table');
        tasksTable.className = 'notes';
    
        // Create table header
        tasksHeader = document.createElement('tr');
        tasksTitleCell = document.createElement('th');
        tasksTitleCell.style.width = '100%';
        setText(tasksTitleCell, 'Task');
        tasksPriCell = document.createElement('th');
        setText(tasksPriCell, 'Priority');
        tasksDeadCell = document.createElement('th');
        setText(tasksDeadCell, 'Deadline');
        tasksDelCell = document.createElement('th');
        setText(tasksDelCell, 'Delete');
        tasksHeader.appendChild(tasksTitleCell);
        tasksHeader.appendChild(tasksPriCell);
        tasksHeader.appendChild(tasksDeadCell);
        tasksHeader.appendChild(tasksDelCell);
    
        tasksTable.appendChild(tasksHeader);

        // Create table rows
        for (taskNum = 0; taskNum < myTasks.length; taskNum++) {
            task = myTasks[taskNum];

            // Create task row
            taskRow = document.createElement('tr');
            taskRow.style.textAlign = 'center';
            titleCell = document.createElement('td');
            titleCell.style.textAlign = 'left';
            taskLink = document.createElement('a');
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
            priCell = document.createElement('td');
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
            deadCell = document.createElement('td');
            deadCell.style.whiteSpace = 'nowrap';
            deadCell.style.paddingRight = '8px';
            setText(deadCell, deadText);
            delCell = document.createElement('td');
            delCell.style.paddingRight = '8px';
            delLink = document.createElement('a');
            delLink.href = '#';
            delLink.setAttribute('data-task', JSON.stringify(task));
            delLink.onclick = function() {
                t = JSON.parse(this.getAttribute('data-task'));
                conf = confirm('Are you sure you want to delete task "' + t.name + '"?');
                if (conf) {deleteTask(this.getAttribute('data-task'), taskView, false);}
            };
            delImg = document.createElement('img');
            delImg.src = 'images/x.png';
            delImg.alt = 'Remove task';
            delLink.appendChild(delImg);
            delCell.appendChild(delLink);

            taskRow.appendChild(titleCell);
            taskRow.appendChild(priCell);
            taskRow.appendChild(deadCell);
            taskRow.appendChild(delCell);

            tasksTable.appendChild(taskRow);
        }

        if (useNightTheme()) {switchToNight(tasksTable);}

        taskView.appendChild(tasksTable);
    }
}

function deleteProject(projectID, viewMode, taskView) {
    // Verify project can be deleted and user wants to
    n = projectsByID[projectID].name;
    if (n === 'Default') {
        alert('The default project can\'t be deleted!');
        exit;
    }
    conf = confirm('Are you sure you want to delete project \'' + n + '\'?');
    if (!conf) {return;}

    // Delete project
    deleteProjectReq = createPostReq('tasks.cgi', false);
    deleteProjectReq.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            if (this.responseText != 'success') {
                alert('Project deletion failed with error ' + this.responseText);
            }
        }
    };
    deleteProjectReq.send('mode=4&id=' + projectID);

    // Reset view
    fetchTaskData();
    if (viewMode === 'project') {populateUpcoming(taskView);}
    populateProjects(taskView.parentElement.children[0].children[0]);
}

function deleteTask(task, taskView, returnToOverview) {
    t = JSON.parse(task);
    deleteTaskReq = createPostReq('tasks.cgi', false);

    deleteTaskReq.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            if (this.responseText == 'success') {
                fetchTaskData();
    
                if (returnToOverview != '0') {
                    populateUpcoming(taskView);
                } else {
                    openProject(taskView, projectsByID[t.project]);
                }
            } else {
                e = taskView.getElementsByClassName('error')[0];
                if (e) {
                    e.style.color = 'red';
                    setText(e, 'Failed to delete task');
                } else {
                    alert('Failed to delete task!');
                }
            }
        }
    };

    deleteTaskReq.send('mode=3&id=' + t.id);
}

function openTask(task, taskView, redirectView) {
    deleteAllChildren(taskView, 1);
    taskView.parentElement.children[0].setAttribute('data-project-id', task.project);
    c = 'black';
    if (useNightTheme()) {c = 'silver';}

    // If task has a project, display path
    if (task.project != -1) {
        // Display task path
        projLinks = createProjectLinks(task.project, c, 1, 1);
        addProjectLinks(projLinks, c, taskView, true)
    }

    // Add this task
    if (task.project !== -1) {
        tmpP = document.createElement('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = c;
        setText(tmpP, '\u00a0:\u00a0');
        tmpP.style.fontWeight = 'bold';
        tmpP.style.fontSize = '115%';
        taskView.appendChild(tmpP);
    }

    tmpP = document.createElement('p');
    tmpP.style.display = 'inline';
    tmpP.style.color = c;
    setText(tmpP, task.name);
    tmpP.style.whiteSpace = 'nowrap';
    tmpP.style.fontWeight = 'bold';
    tmpP.style.fontSize = '115%';
    taskView.appendChild(tmpP);

    // If task path wraps, indent each new line
    lastOffset = taskView.children[1].offsetTop;
    for (p = 2; p < taskView.childElementCount; p++) {
        e = taskView.children[p];
        if (e.offsetTop > lastOffset) {
            lastOffset = e.offsetTop;
            taskView.insertBefore(document.createTextNode(stringFill('\u00a0', 4)), e);
        }
    }

    // Delete task button, if not new
    if (task.id != -1) {
        deleteTaskElem = document.createElement('p');
        deleteTaskElem.style.display = 'inline';
        setText(deleteTaskElem, '\u00a0\u00a0');
        deleteTaskLink = document.createElement('a');
        deleteTaskLink.href = '#';
        deleteTaskLink.setAttribute('data-task', JSON.stringify(task));
        deleteTaskLink.onclick = function() {
            t = JSON.parse(this.getAttribute('data-task'));
            conf = confirm('Are you sure you want to delete task "' + t.name + '"?');
            if (conf) {deleteTask(this.getAttribute('data-task'), taskView, false);}
        };
        deleteTaskImg = document.createElement('img');
        deleteTaskImg.src = 'images/x.png';
        deleteTaskImg.title = 'Delete task';
        deleteTaskImg.alt = 'Delete task';
        deleteTaskLink.appendChild(deleteTaskImg);
        deleteTaskElem.appendChild(deleteTaskLink);
        taskView.appendChild(deleteTaskElem);
    }

    taskView.appendChild(document.createElement('br'));
    taskView.appendChild(document.createElement('br'));

    // Create task edit GUI
    // Project
    projectSelect = projectsToSelect(task.project);
    projectSelect.onchange = function() {
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-project', this.value);
        saveButton.setAttribute('data-project', JSON.stringify(projectsByID[this.value]));
    }
    taskView.appendChild(projectSelect);

    // Title
    titleLabel = document.createElement('p');
    titleLabel.className = 'normal_text form_label';
    setText(titleLabel, 'Task\u00a0name:\u00a0')
    titleInput = document.createElement('input');
    titleInput.style.width = '75%';
    titleInput.value = task.name;

    // Description
    descLabel = document.createElement('p');
    descLabel.className = 'normal_text form_label';
    setText(descLabel, 'Task\u00a0Description:');
    descInput = document.createElement('textarea');
    descInput.style.width = '90%';
    descInput.style.height = '30%';
    descInput.value = task.description;

    // Priority
    priLabel = document.createElement('p');
    priLabel.className = 'normal_text form_label';
    priLabel.style.display = 'inline';
    setText(priLabel, 'Task\u00a0Priority\u00a0(High to low):\u00a0\u00a0');

    priInput = document.createElement('select');
    for (o = 1; o <= 12; o++) {
        opt = document.createElement('option');
        setText(opt, o);
        opt.value = o;
        if (o == task.priority) {opt.selected = true;}
        priInput.appendChild(opt);
        if (useNightTheme()) {switchToNight(opt);}
    }

    // Deadline
    // Elements
    deadlineGroup = document.createElement('fieldset');
    deadlineGroup.style.width = '92%';
    deadlineLabel = document.createElement('legend');
    setText(deadlineLabel, 'Deadline');
    urgentRadio = document.createElement('input');
    urgentRadio.name = 'deadline';
    urgentRadio.type = 'radio';
    urgentRadio.value = 'u';
    urgentRadio.onclick = function() {
        e = this;
        for (i = 0; i < 6; i++) {
            e = e.nextElementSibling;
        }

        e.readOnly = true;
    };
    urgentLabel = document.createElement('p');
    urgentLabel.className = 'normal_text';
    urgentLabel.style.display = 'inline';
    setText(urgentLabel, 'ASAP');
    otherRadio = document.createElement('input');
    otherRadio.name = 'deadline';
    otherRadio.type = 'radio';
    otherRadio.value = 's';
    otherRadio.onclick = function() {
        e = this;
        for (i = 0; i < 4; i++) {
            e = e.nextElementSibling;
        }

        e.readOnly = true;
    };
    otherLabel = document.createElement('p');
    otherLabel.className = 'normal_text';
    otherLabel.style.display = 'inline';
    setText(otherLabel, 'No deadline');
    dateRadio = document.createElement('input');
    dateRadio.name = 'deadline';
    dateRadio.type = 'radio';
    dateRadio.value = 'd';
    dateRadio.onclick = function() {
        this.nextElementSibling.nextElementSibling.disabled = false;
    };
    dateLabel = document.createElement('p');
    dateLabel.className = 'normal_text';
    dateLabel.style.display = 'inline';
    setText(dateLabel, 'Date\u00a0');
    dateInput = document.createElement('input');
    dateInput.className = 'normal_text';
    dateInput.type = 'datetime-local';
    dateInput.onclick = function() {
        this.readOnly = false;
        this.previousElementSibling.previousElementSibling.checked = true;
    }

    // Add defaults to deadline fields
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
    }
    
    // If datetime input type isn't supported
    if (dateInput.type == 'text') {
        if (dateInput.value === '') {
            dateInput.value = 'YYYY-MM-DD HH:MM';
        } else {dateInput.value = dateInput.value.replace('T', ' ');}
        dateInput.onchange = function() {
            year = /[0-9]{4}-/;
            month = /(0[1-9]|1[12])-/;
            date = /(0[1-9]|[12][0-9]|3[01])-/;
            hour = / ([01][0-9]|2[0-3]):/;
            minute = /[0-5][0-9]/;
            yearValid = 1;
            monthValid = 1;
            dateValid = 1;
            hourValid = 1;
            minuteValid = 1;

            v = dateInput.value;
            newValue = '';
            // Verify date and time validity, reset if invalid otherwise keep
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
            dateInput.value = newValue;
        }
    }

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
    }

    // Create save and cancel buttons
    errorText = document.createElement('p');
    errorText.className = 'error';
    errorText.style.display = 'inline';
    setText(errorText, '\u00a0');
    saveButton = document.createElement('button');
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
    saveButton.onclick = function() {
        errorText = this.nextElementSibling.nextElementSibling;
        sB = this;
        
        saveTaskReq = createPostReq('tasks.cgi', true);

        saveTaskReq.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                if (this.responseText === 'success') {
                    errorText.style.color = 'green';
                    setText(errorText, 'Saved at ' + getTimeFromString(new Date().toString()));

                    fetchTaskData();
                    if (sB.getAttribute('data-redirect') == 'project') {
                        openProject(taskView, JSON.parse(sB.getAttribute('data-project')));
                    } else {
                        populateUpcoming(taskView);
                    }
                } else {
                    errorText.style.color = 'red';
                    setText(errorText, 'Save failed - ' + this.responseText);
                }
            }
        };

        saveTaskReq.send('mode=2&id=' + this.getAttribute('data-task-id') + '&n=' + this.getAttribute('data-task-name') + 
                         '&pj=' + this.getAttribute('data-task-project') + '&ds=' + this.getAttribute('data-task-desc') + 
                         '&p=' + this.getAttribute('data-task-priority') + '&d=' + this.getAttribute('data-task-deadline'));
    };

    cancelButton = document.createElement('button');
    setText(cancelButton, 'Cancel');
    cancelButton.onclick = function() {
        if (task.project != -1) {
            openProject(taskView, projectsByID[task.project]);
        } else {
            populateUpcoming(taskView);
        }
    }

    if (useNightTheme()) {
        switchToNight(saveButton, cancelButton);
    }

    // Text handlers
    titleInput.onchange = function() {
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
    }

    descInput.onchange = function() {
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-desc', this.value);
    }

    priInput.onchange = function() {
        saveButton = this.parentElement.getElementsByTagName('button')[0];
        saveButton.setAttribute('data-task-priority', this.value);
    }

    urgentRadio.onchange = function() {
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        if (this.checked) {saveButton.setAttribute('data-task-deadline', 'u');}
    }

    otherRadio.onchange = function() {
        saveButton = this.parentElement.parentElement.getElementsByTagName('button')[0];
        if (this.checked) {saveButton.setAttribute('data-task-deadline', 's');}
    }

    dateRadio.onchange = function() {
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
    }

    dateInput.onchange = function() {
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
    }
    
    // Add children
    taskView.appendChild(titleLabel);
    taskView.appendChild(titleInput);
    taskView.appendChild(descLabel);
    taskView.appendChild(descInput);
    taskView.appendChild(document.createElement('br'));
    taskView.appendChild(document.createElement('br'));
    taskView.appendChild(priLabel);
    taskView.appendChild(priInput);
    taskView.appendChild(deadlineGroup);
    taskView.appendChild(document.createElement('br'));
    taskView.appendChild(saveButton);
    taskView.appendChild(document.createTextNode('\u00a0\u00a0'));
    taskView.appendChild(cancelButton);
    taskView.appendChild(document.createTextNode('\u00a0\u00a0'));
    taskView.appendChild(errorText);
}

function fetchTaskData() {
    getTasksReq = createPostReq('tasks.cgi', false);
    getTasksReq.send('mode=0');
    if (getTasksReq.responseText === 'noauth') {
        alert('Session timed out! Please copy any unsaved changes then refresh the page.');
    } else if (getTasksReq.responseText === 'Bad request!') {
        alert('Invalid request! Please copy any unsaved changes then refresh the page.');
    }
    rootProjects.length = 0;
    subProjects.length = 0;
    data = JSON.parse(getTasksReq.responseText);
    projects = data[0];
    parseProjects();
    tasks = data[1];
    sortedTasks = organizeTasks(tasks);
}

function getSubprojects(projectID, projectIDs) {
    projectIDs.push(projectID);
    if (subProjects[projectID]) {
        for (subp = 0; subp < subProjects[projectID].length; subp++) {
            projectIDs = getSubprojects(subProjects[projectID][subp].id, projectIDs);
        }
    }

    return projectIDs;
}

function getTasksInProject(projectID) {
    projectTasks = [[], [], []];
    projectIDs = [projectID];
    if (subProjects[projectID]) {projectIDs = getSubprojects(projectID, []);}

    // For each project
    for (p = 0; p < projectIDs.length; p++) {
        // For each kind of task
        for (taskGroup = 0; taskGroup < sortedTasks.length; taskGroup++) {
            // If tasks exist, add them to the list
            if (!sortedTasks[taskGroup][projectIDs[p]]) {continue;}
            sortedTasks[taskGroup][projectIDs[p]].map(function(t) {projectTasks[taskGroup].push(t);});
        }
    }

    return projectTasks;
}

function organizeTasks(tasks) {
    urgent = new Array();
    other = new Array();
    normal = new Array();
    for (taskNum = 0; taskNum < tasks.length; taskNum++) {
        task = tasks[taskNum];
        if (task.is_urgent) {
            if (!urgent[task.project] || urgent[task.project].constructor.name !== 'Array') {
                urgent[task.project] = new Array();
            }
            urgent[task.project].push(task);
        } else if (task.is_other) {
            if (!other[task.project] || other[task.project].constructor.name !== 'Array') {
                other[task.project] = new Array();
            }
            other[task.project].push(task);
        } else {
            if (!normal[task.project] || normal[task.project].constructor.name !== 'Array') {
                normal[task.project] = new Array();
            }
            normal[task.project].push(task);
        }
    }
    
    return [urgent, other, normal];
}

function sortTasksByPriority(t1, t2) {
    if (t1.priority == t2.priority) {
        return (t1.name > t2.name) ? 1 : -1;
    }
    return (t1.priority > t2.priority) ? 1 : -1;
}

function projectsToSelect(projectID) {
   projectSelect = document.createElement('select');
    for (root = 0; root < rootProjects.length; root++) {
        currentRoot = rootProjects[root];
        addOption(currentRoot, 0, projectSelect, projectID);
        if (subProjects[currentRoot.id]) {
            addOptionTree(subProjects[currentRoot.id], 0, projectSelect, projectID);
        }
    }

    if (useNightTheme()) {switchToNight(projectSelect);}
    return projectSelect;
}

function addOptionTree(projects, level, select, projectID) {
    for (s = 0; s < projects.length; s++) {
        p = projects[s];
        addOption(p, level + 1, select, projectID);
        if (subProjects[p.id]) {addOptionTree(subProjects[p.id], level + 1, select, projectID);}
    }
}

function addOption(project, level, select, projectID) {
    opt = document.createElement('option');
    opt.value = project.id;
    if (project.id == projectID) {opt.selected = 'selected';}
    setText(opt, stringFill('\u00a0', 3 * level) + project.name);
    if (useNightTheme()) {switchToNight(opt);}
    select.appendChild(opt);
}

function tasksToHTML(urgent, normal, other, fromOverview) {
    redirectView = (fromOverview == 1) ? 'overview' : 'project';
    // Create urgent tasks
    urgentHeader = document.createElement('p');
    urgentHeader.className = 'normal_section_header';
    urgentHeader.style.fontWeight = 'bold';
    urgentHeader.style.marginBottom = '0px';
    setText(urgentHeader, 'ASAP');

    urgentHR = document.createElement('hr');
    urgentHR.className = 'task_divider';

    urgentTasks = document.createElement('span');
    for (taskNum = 0; taskNum < urgent.length; taskNum++) {
        task = urgent[taskNum];
        addTask(task, urgentTasks, false, fromOverview, redirectView);
    }

    // Create tasks with deadlines
    normal.sort(function(a, b) {
        if (deadlineToDate(a.deadline).getTime() == deadlineToDate(b.deadline).getTime()) {
            return sortTasksByPriority(a, b);
        } else {
            return ((deadlineToDate(a.deadline).getTime()) > (deadlineToDate(b.deadline).getTime())) ? 1 : -1;
        }
    });

    currentDate = 0;
    normalTasks = document.createElement('span');
    for (taskNum = 0; taskNum < normal.length; taskNum++) {
        task = normal[taskNum];

        d = deadlineToDate(task.deadline);
        // If date has changed
        if (d.toLocaleDateString() != currentDate) {
            currentDate = d.toLocaleDateString();

            dateHeader = document.createElement('p');
            dateHeader.className = 'normal_section_header';
            dateHeader.style.fontWeight = 'bold';
            dateHeader.style.marginBottom = '0px';
            setText(dateHeader, d.toDateString());

            dateHR = document.createElement('hr');
            dateHR.className = 'task_divider';
            if (useNightTheme()) {
                switchToNight(dateHeader, dateHR);
            }

            normalTasks.appendChild(dateHeader);
            normalTasks.appendChild(dateHR);
        }
        addTask(task, normalTasks, true, fromOverview, redirectView);
    }

    // Create other tasks
    otherHeader = document.createElement('p');
    otherHeader.className = 'normal_section_header';
    otherHeader.style.fontWeight = 'bold';
    otherHeader.style.marginBottom = '0px';
    setText(otherHeader, 'When Possible');

    otherHR = document.createElement('hr');
    otherHR.className = 'task_divider';

    otherTasks = document.createElement('span');
    for (taskNum = 0; taskNum < other.length; taskNum++) {
        task = other[taskNum];
        addTask(task, otherTasks, false, fromOverview, redirectView);
    }

    if (useNightTheme()) {switchToNight(urgentHeader, urgentHR, otherHeader, otherHR);}
    return [urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks];
}

function addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks) {
    if (urgent.length !== 0) {
        urgentHeader.style.cssFloat = 'left';
        taskView.appendChild(urgentHeader);
        if (css_browser_selector(navigator.userAgent).search('ff') !== -1) {
            newTaskP.style.paddingRight = '5px';
            urgentHR.style.marginTop = '2px';
            taskView.appendChild(document.createElement('br'));
            taskView.appendChild(document.createElement('br'));
        }
        taskView.appendChild(urgentHR);
        taskView.appendChild(urgentTasks);
    }
    if (normal.length !== 0) {
        if (urgent.length === 0) {normalTasks.children[0].style.cssFloat = 'left';}
        if (css_browser_selector(navigator.userAgent).search('ff') !== -1 && urgent.length === 0) {
            newTaskP.style.marginRight = '5px';
            normalTasks.children[1].style.marginTop = '8px';
            taskView.appendChild(normalTasks.children[0]);
            taskView.appendChild(document.createElement('br'));
            taskView.appendChild(document.createElement('br'));
        }
        taskView.appendChild(normalTasks);
    }
    if (other.length !== 0) {
        if (urgent.length === 0 && normal.length === 0) {otherHeader.style.cssFloat = 'left';}
        taskView.appendChild(otherHeader);
        if (css_browser_selector(navigator.userAgent).search('ff') != -1 && urgent.length === 0 && normal.length === 0) {
            newTaskP.style.paddingRight = '5px';
            otherHR.style.marginTop = '2px';
            taskView.appendChild(document.createElement('br'));
            taskView.appendChild(document.createElement('br'));
        }
        taskView.appendChild(otherHR);
        taskView.appendChild(otherTasks);
    }

    // If no tasks in any section
    if (urgent.length === 0 && normal.length === 0 && other.length === 0) {
        blank = document.createElement('p');
        blank.className = 'normal_text';
        blank.style.marginTop = '0px';
        blank.style.fontStyle = 'italic';
        setText(blank, stringFill('\u00a0', 4) + 'No tasks');

        if (useNightTheme()) {switchToNight(blank);}

        taskView.appendChild(blank);
    }
}

function parseProjects() {
    defaultProject = -1;
    for (project = 0; project < projects.length; project++) {
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
    }
    rootProjects.sort(function(p1, p2) {return (p1.name > p2.name);});
    rootProjects.splice(0, 0, defaultProject);
}

function populateProjects(projectsList) {
    deleteAllChildren(projectsList);

    // Create project list headers
    projectsListHeader = document.createElement('span');
    upcomingTitle = document.createElement('p');
    upcomingTitle.className = 'normal_section_header';
    upcomingTitle.style.marginTop = '5px';
    upcomingTitle.style.marginBottom = '10px';
    upcomingLink = document.createElement('a');
    upcomingLink.className = 'normal_section_header';
    upcomingLink.href = '#';
    upcomingLink.onclick = function() {
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
            // For each task/header in them
            for (pNum = 0; pNum < span.childElementCount; pNum++) {
                p = span.children[pNum];
                // Eliminate headers
                if (p.className.search('normal_text') === -1) {continue;}
                offset = p.children[0].offsetTop;
                breakLine = 0;
                // For each of their children
                for (cNum = 1; cNum < p.childElementCount; cNum++) {
                    c = p.children[cNum];
                    childBreakFound = 0
                    // If it has children (some do, some don't)
                    if (c.childElementCount) {
                        for (c2Num = 0; c2Num < c.childElementCount; c2Num++) {
                            c2 = c.children[c2Num];
                            if (c2.offsetTop > offset) {
                                childBreakFound = 1;
                                break;
                            }
                        }
                    }

                    if (childBreakFound || c.offsetTop > offset) {
                        breakLine = 1;
                        break;
                    }
                }

                if (breakLine) {
                    if (span.children[pNum + 1]) {
                        span.insertBefore(document.createElement('br'), span.children[pNum + 1]);
                    } else {
                        span.appendChild(document.createElement('br'));
                    }
                }
            }
        }
    }
    setText(upcomingLink, 'Overview');
    upcomingTitle.appendChild(upcomingLink);

    projectsTitle = document.createElement('p');
    projectsTitle.className = 'normal_section_header';
    projectsTitle.style.marginTop = '5px';
    projectsTitle.style.marginBottom = '10px';
    setText(projectsTitle, 'Projects:');

    if (useNightTheme()) {switchToNight(upcomingTitle, upcomingLink, projectsTitle);}

    projectsListHeader.appendChild(upcomingTitle);
    projectsListHeader.appendChild(projectsTitle);
    projectsList.appendChild(projectsListHeader);

    // Create project list
    for (project = 0; project < rootProjects.length; project++) {
        currentRoot = rootProjects[project];
        addProject(projectsList, currentRoot, 0);
    }
}

function populateUpcoming(taskView) {
    deleteAllChildren(taskView, 1);

    upcomingP = document.createElement('p');
    upcomingP.className = 'normal_section_header';
    setText(upcomingP, 'Upcoming tasks');
    upcomingP.style.marginTop = '0px';

    if (useNightTheme()) {switchToNight(upcomingP);}

    taskView.appendChild(upcomingP);

    // Add new task button
    newTaskP = document.createElement('p');
    newTaskP.style.display = 'inline';
    newTaskP.style.cssFloat = 'right';
    newTaskP.style.marginBottom = '2px';
    newTaskButton = document.createElement('button');
    newTaskButton.onclick = function() {
        openTask(makeBlankTask('-1'), taskView, 'overview');
    }
    setText(newTaskButton, 'Create task');
    newTaskP.appendChild(newTaskButton);

    if (useNightTheme()) {switchToNight(newTaskButton);}

    taskView.appendChild(newTaskP);

    // Tasks sorted by deadline, priority, then name
    // sortedTask is two-dimensional array, but project is
    // inconsequential for the task view, so flatten them
    urgent = flatten(sortedTasks[0]);
    other = flatten(sortedTasks[1]);
    normal = flatten(sortedTasks[2]);
    urgent.sort(sortTasksByPriority);
    other.sort(sortTasksByPriority);

    // Create HTML elements from tasks
    out = tasksToHTML(urgent, normal, other, 1);
    urgentHeader = out[0];
    urgentHR = out[1];
    urgentTasks = out[2];
    normalTasks = out[3];
    otherHeader = out[4];
    otherHR = out[5];
    otherTasks = out[6];

    addHTMLTasks(taskView, urgentHeader, urgentHR, urgentTasks, normalTasks, otherHeader, otherHR, otherTasks);
}

function createProjectLinks(projectID, color, levelsToRoot, isTitle) {
    projLinks = [createProjectLink(projectsByID[projectID], levelsToRoot)];
    projLinks[0].style.color = color;
    projParent = projectHierarchy[projectID];
    while (projParent) {
        projLinks.push(createProjectLink(projectsByID[projParent], levelsToRoot));
        projLinks[projLinks.length - 1].style.color = color;
        projParent = projectHierarchy[projParent];
    }

    // If this is a title, add an overview link
    if (isTitle) {
        overviewLink = document.createElement('a');
        overviewLink.className = 'normal_text';
        overviewLink.href = '#';
        overviewLink.style.whiteSpace = 'nowrap';
        overviewLink.style.color = color;
        overviewLink.onclick = function() {
            fetchTaskData();
            populateUpcoming(taskView);
        };
        setText(overviewLink, 'Overview');
        projLinks.push(overviewLink);
    }

    projLinks.reverse();
    return projLinks;
}

function createProjectLink(project, levelsToRoot) {
    projAnchor = document.createElement('a');
    projAnchor.className = 'normal_text';
    projAnchor.href = '#';
    projAnchor.style.whiteSpace = 'nowrap';
    projAnchor.setAttribute('data-project', JSON.stringify(project));
    projAnchor.setAttribute('data-levels-to-root', levelsToRoot);
    projAnchor.onclick = function() {
        levels = parseInt(this.getAttribute('data-levels-to-root'), 10);
        taskView = this;
        for (levels = levels; levels > 0; levels--) {taskView = taskView.parentElement;}
        openProj = JSON.parse(this.getAttribute('data-project'));
        openProject(taskView, openProj);
    };
    setText(projAnchor, project.name);
    return projAnchor;
}

function addProjectLinks(projLinks, color, parent, isTitle) {
    // Add opening bracket
    if (!isTitle) {
        tmpP = document.createElement('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = color;
        setText(tmpP, '\u00a0\u00a0\u00a0&lt;');
        parent.appendChild(tmpP);
    }

    for (link = 0; link < projLinks.length; link++) {
        projLink = projLinks[link];
        if (isTitle) {projLink.style.fontWeight = 'bold'; projLink.style.fontSize = '115%';}
        parent.appendChild(projLink);
        // If not on last link
        if (link != (projLinks.length - 1)) {
            tmpP = document.createElement('p');
            tmpP.style.display = 'inline';
            tmpP.style.color = color;
            setText(tmpP, '\u00a0: ');
            if (isTitle) {tmpP.style.fontWeight = 'bold'; tmpP.style.fontSize = '115%';}
            parent.appendChild(tmpP);
        }
    }

    // Add closing bracket
    if (!isTitle) {
        tmpP = document.createElement('p');
        tmpP.style.display = 'inline';
        tmpP.style.color = color;
        setText(tmpP, '&gt;');
        parent.appendChild(tmpP);
    }
}

function addProject(parent, project, level) {
    /* Create and add this project to the list
       In state preservation, level == 0 means root project
       Since some conditions account for the level == 0 part,
       then project.id doesn't need to be checked since what actually matters
       is that its parent is expanded, not itself
       The parts that set the '+'+ or '-' text do not care if the project
       is a root or sub project, and therefore the ID must be checked
       in addition to the parent
    */

    // Expand project button
    expandProject = document.createElement('a');
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
    setText(expandProject, stringFill('\u00a0', 3 * level) + '~');

    // Open project text
    openProjectLink = document.createElement('a');
    openProjectLink.href = '#';
    openProjectLink.style.textDecoration = 'none';
    openProjectLink.setAttribute('data-project', JSON.stringify(project));
    openProjectLink.onclick = function() {
        taskView = this.parentElement.parentElement.parentElement.children[1];
        openProj = JSON.parse(this.getAttribute('data-project'));
        openProject(taskView, openProj);
    };
    projectName = document.createElement('p');
    projectName.className = 'project_name';
    setText(projectName, '\u00a0' + project.name);
    openProjectLink.appendChild(projectName);

    // Delete project button
    removeProjectLink = document.createElement('a');
    removeProjectLink.className = 'blank';
    removeProjectLink.href = '#';
    removeProjectLink.setAttribute('data-project-id', project.id);
    removeProjectLink.setAttribute('data-project-name', project.name);
    removeProjectLink.onclick = function() {
        taskView = this.parentElement.parentElement.parentElement.children[1];
        deleteProject(this.getAttribute('data-project-id'), 'tree', taskView);
    };
    removeProjectImg = document.createElement('img');
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
    if (level === 0 || expanded[project.parent] == 1) {parent.appendChild(document.createElement('br'));}

    // If there are actually projects to expand
    if (subProjects[project.id] && subProjects[project.id].length) {
        if (expanded[project.id] && subProjects[project.id].length) {
            setText(expandProject, stringFill('\u00a0', 3 * level) + '-' + '\u00a0');
        } else if (subProjects[project.id].length) {
            setText(expandProject, stringFill('\u00a0', 3 * level) + '+');
        }
        expandProject.href = '#';
        expandProject.onclick = function() {
            nextSibling = this.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling;
            // Collapse
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
                }
            // Expand
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
                    // Make sure that we are still only one level deeper than the expanded element
                    if (nextLevel) {
                        while ((!nextLevel) ||
                            nextLevel.toString() !== (parseInt(this.getAttribute('data-level'), 10) + 1).toString()) {
                            if (nextLevel && nextLevel.toString() === this.getAttribute('data-level')) {break;}
                            nextSibling = nextSibling.nextElementSibling;
                            nextLevel = nextSibling.getAttribute('data-level');
                        }
                    }
                    if (nextSibling.getAttribute('data-level') === this.getAttribute('data-level')) {break;}
                    nextSibling.style.display = 'inline';
                    count++;
                    // If at end of elements for this project, add new line
                    if (count == 3) {
                        count = 0;
                        parent.insertBefore(document.createElement('br'), nextSibling.nextElementSibling);
                        nextSibling = nextSibling.nextElementSibling;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
            }
        };

        for (subp = 0; subp < subProjects[project.id].length; subp++) {
            parent.setAttribute('data-current-sub-' + level, subp);
            subpr = subProjects[project.id][subp];
            addProject(parent, subpr, level + 1, projectsByID, projectHierarchy, subProjects, tasks);
            subp = parent.getAttribute('data-current-sub-' + level);
        }
    }
}

function addTask(task, parent, showTime, fromOverview) {
    color = 0;
    if (task.priority > colors.length) {
        color = colors[colors.length - 1];
    } else {
        color = colors[task.priority - 1];
    }

    projLinks = createProjectLinks(task.project, color, 4, false);

    // If normal, should have a deadline
    taskDate = 0;
    if (showTime === true) {
        taskDate = document.createElement('p');
        taskDate.style.display = 'inline';
        taskDate.style.color = color;

        deadline = task.deadline;
        deadline = deadline.replace('-', '/');
        deadline = deadline.replace('-', '/');
        deadline = deadline.split('+')[0];
        d = new Date(deadline);
        time = getTimeFromString(d.toString());
        setText(taskDate, time + stringFill('\u00a0', 2));
    }
    
    // Create task link
    taskElem = document.createElement('p');
    taskElem.className = 'normal_text';
    taskElem.appendChild(document.createTextNode(stringFill('\u00a0', 4)));
    taskElem.style.height = '20px';
    taskElem.style.marginTop = '0px';
    taskElem.style.marginBottom = '5px';
    taskLink = document.createElement('a');
    taskLink.className = 'normal_text';
    taskLink.style.color = color;
    taskLink.style.fontWeight = 'bold';
    taskLink.href = '#';
    taskLink.setAttribute('data-task', JSON.stringify(task));
    taskLink.onclick = function() {
        taskView = this.parentElement.parentElement.parentElement;
        openTask(JSON.parse(this.getAttribute('data-task')), taskView, redirectView);
    };
    setText(taskLink, task.name);
    taskProj = document.createElement('p');
    taskProj.style.color = color;
    taskProj.style.display = 'inline';

    addProjectLinks(projLinks, color, taskProj, false);
    
    // Create delete task
    delTaskP = document.createElement('p');
    delTaskP.style.display = 'inline';
    setText(delTaskP, '\u00a0\u00a0');
    delTaskImg = document.createElement('img');
    delTaskImg.src = 'images/x.png';
    delTaskImg.title = 'Delete task';
    delTaskImg.alt = 'Delete task';
    delTaskLink = document.createElement('a');
    delTaskLink.href = '#';
    delTaskLink.setAttribute('data-task', JSON.stringify(task));
    delTaskLink.setAttribute('data-from-overview', fromOverview);
    delTaskLink.onclick = function() {
        t = JSON.parse(this.getAttribute('data-task'));
        conf = confirm('Are you sure you want to delete task "' + t.name + '"?');
        if (!conf) {return;}
        deleteTask(this.getAttribute('data-task'), parent.parentElement, this.getAttribute('data-from-overview'));
    };
    delTaskLink.appendChild(delTaskImg);
    delTaskP.appendChild(delTaskLink);

    if (showTime === true) {taskElem.appendChild(taskDate);}
    taskElem.appendChild(taskLink);
    taskElem.appendChild(taskProj);
    taskElem.appendChild(delTaskP);

    if (useNightTheme()) {switchToNight(taskElem, taskLink, taskProj, delTaskP, delTaskLink);}

    parent.appendChild(taskElem);
}

/* Account Management */
function viewAccount() {
    id = 'my_account_' + new Date().getTime();
    accountPanel = document.createElement('div');
    accountPanel.id = id;

    privilegesReq = createPostReq('account.cgi', false);

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
                    if (this.value === '' || this.value.length < 8) {
                        b.disabled = true;
                    } else if (this.value ===
                               document.getElementById(this.getAttribute('data-other-input-id')).value) {
                        b.disabled = false;
                        setText(document.getElementById(this.getAttribute('data-error-id')), '\u00a0');
                    } else {
                        b.disabled = true;
                    }
                };
                p1.onchange = function() {
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
                };
                p2.onkeyup = function() {
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
                };
                p2.onchange = function() {
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
                };

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
                // Elements
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


