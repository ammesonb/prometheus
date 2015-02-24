import sys, os, socket, select
from textwrap import wrap
from prom_ac import *
from time import sleep
from getpass import getpass
from hashlib import sha512

def getAuth(): #{{{
    user = raw_input('Username: ')
    pw = getpass('Password: ')
    pw = pw.strip()
    pw = sha512(pw).hexdigest()
    return user, pw #}}}
    
sep = '#__#'
width = 70
space = 3
port = 35792
destPort = 35793
contents = []

# Get address of server using network broadcast #{{{
bSock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
bSock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
bSock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
bSock.setblocking(0)
bSock.bind(('<broadcast>', port))
bSock.sendto('prom_web_q', ('<broadcast>', destPort))
results = select.select([bSock], [], [], 20)
data = ''
if len(results[0]):
    data = results[0][0].recv(999)
    if 'prom_web_r' not in data:
        print 'Invalid response - no prometheus instance found'
        exit(1)
else:
    print 'Socket timeout - no prometheus instance found'
    exit(1)

ip = data.replace('prom_web_r#', '')
ip = ip.strip() #}}}

# Authenticate #{{{
user, pw = getAuth()
pSock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
pSock.connect((ip, destPort))
authStr = 'auth' + sep + user + sep + pw
pSock.send(authStr)
auth = pSock.recv(999)
auth = auth.strip()
while not int(auth):
    print 'Invalid username or password'
    user, pw = getAuth()
    authStr = 'auth' + sep + user + sep + pw
    print 'send'
    pSock.send(authStr)
    print 'recv'
    auth = pSock.recv(999)
    print 'r'
    auth = auth.strip() #}}}

def print_help(): #{{{
    print "\nPrometheus CLI\n\
    help      Display this message\n\
    ls        List files\n\
    search    Return any matches for a given string\n\
    info      Prints details of file\n\
    get       Transfer a file\n\
    gets      Transfer a series\n\
    getse     Transfer a season\n\
    getsh     Transfer a TV show\n\
    exit      Quit program\
" #}}}

def print_long_text(text_list): #{{{
    lineLen = 0
    for i in range(len(text_list)):
        t = text_list[i]
        if len(t) > width:
            pass
        elif lineLen + len(t) + space < width:
            print t + ' ' * space,
            lineLen += len(t) + space
        else:
            lineLen = len(t) + space
            print '\n' + t + ' ' * space,
    print '\n' #}}}

def get_contents(): #{{{
    global contents
    pSock.send('ls');
    data = pSock.recv(999)
    contents = data.split(';')
    contents.sort()
    contents.insert(0, '..') #}}}

def parse_cmd(cmd): #{{{
    cmd = cmd.split(' ', 1)
    if cmd[0] == 'ls': #{{{
        print_long_text(contents) #}}}
    elif cmd[0] == 'cd' or (cmd not in COMMANDS and cmd in contents): #{{{
        newDir = cmd
        if cmd[0] == 'cd':
            newDir = cmd[1]
        pSock.send('cd' + sep + newDir)
        data = pSock.recv(999)
        if data == 'nf':
            print 'Directory does not exist'
        else:
            get_contents() #}}}
    elif cmd[0] == 'search': #{{{
        pSock.send('search' + sep + cmd[1])
        data = pSock.recv(999999)
        t = data.split(';')
        t.sort()
        print '\n'.join(t) #}}}
    elif cmd[0] == 'info': #{{{
        pSock.send('info' + sep + cmd[1])
        data = pSock.recv(999999999)
        if data == 'nf':
            print 'No match'
            return
        elif data[:6] == 'choice': #{{{
            opts = data.replace('choice' + sep, '').split(';')
            opts.sort()
            num = 0
            print 'Please select intended media:'
            for i in opts:
                print str(num) + '. ' + i
                num += 1
            n = raw_input('# ')
            while True:
                try:
                    int(n)
                    break
                except ValueError:
                    print 'Value must be numeric'
                    n = raw_input('# ')
            pSock.send(n)
            data = pSock.recv(999999999) #}}}
        print '\n'.join(data.split(';;;')) #}}}
    #}}}

def get_cmd(): #{{{
    cmd = raw_input(user + '@prometheus-media-server> ')
    parse_cmd(cmd) #}}}

get_contents()
print_help()
while (1):
    get_cmd()
