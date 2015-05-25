import sys, os, socket, select, commands
from textwrap import wrap
from prom_ac import *
from time import sleep
from getpass import getpass

def getAuth(): #{{{
    user = raw_input('Username: ')
    pw = getpass('Password: ')
    pw = pw.strip()
    return user, pw #}}}
    
sep = '#__#'
width = 70
space = 3
port = 35792
destPort = 35794
outDir = '/home/brett/rsync'
contents = []
f = open('rp', 'w')
f.write('ClI#pass')
f.close()
os.chmod('rp', 0400)

# Get default CLI #{{{
#cli = commands.getoutput('update-alternatives --display x-terminal-emulator')
#cli = cli.split('\n')[-1]
#cli = cli.split('\'')
#cli = cli[-2] #}}}

# Get address of server using network broadcast #{{{
bSock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
bSock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
bSock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
bSock.setblocking(0)
bSock.bind(('<broadcast>', port))
bSock.sendto('prom_web_q', ('<broadcast>', destPort))

rbSock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
rbSock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
rbSock.setblocking(1)
rbSock.bind(('', port))

results = select.select([rbSock], [], [], 10)
data = ''
if len(results[0]):
    data = results[0][0].recv(999)
    if 'prom_web_r' not in data:
        print 'Invalid response - no prometheus instance found'
        os.remove('rp')
        exit(1)
else:
    print 'Socket timeout - no prometheus instance found'
    os.remove('rp')
    exit(1)

ip = data.replace('prom_web_r#', '')
ip = ip.strip() #}}}

# Authenticate #{{{
user, pw = getAuth()
pSock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
pSock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
pSock.connect((ip, destPort))
authStr = 'auth' + sep + user + sep + pw
pSock.send(authStr)
auth = pSock.recv(999)
auth = auth.strip()
while not int(auth):
    print 'Invalid username or password'
    user, pw = getAuth()
    authStr = 'auth' + sep + user + sep + pw
    pSock.send(authStr)
    auth = pSock.recv(999)
    auth = auth.strip() #}}}

def print_help(): #{{{
    print "\nPrometheus CLI\n\
    help      Display this message\n\
    ls        List files\n\
    cd        Change directory\n\
    search    Return any matches for a given string\n\
    info      Prints details of file\n\
    get       Transfer a file\n\
    gets      Transfer a series - e.g. Star Wars or Doctor Who\n\
    getse     Transfer a season - e.g. Doctor Who 2\n\
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

def single_select(data, pSock): #{{{
    if data == 'nf':
        print 'No match'
        return
    elif data == 'ns':
        print 'Nonexistent season'
        return
    elif data[:6] == 'choice':
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
                i = int(n)
                if i < 0 or i > num - 1:
                    print 'Value must be one of above choices'
                    n = raw_input('# ')
                else:
                    break
            except ValueError:
                print 'Value must be numeric'
                n = raw_input('# ')
        pSock.send(opts[int(n)])
        data = pSock.recv(999999999)
    return data #}}}

def parse_cmd(cmd): #{{{
    if cmd in ['quit', 'exit']:
        os.remove('rp')
        exit(1)

    cmd = cmd.split(' ', 1)
    if cmd[0] != 'ls' and len(cmd) < 2:
        print 'Need argument'
        return

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
        data = single_select(data, pSock)
        if not data:
            return
        print '\n'.join(data.split(';;;')) #}}}
    elif cmd[0] == 'get': #{{{
        pSock.send('get' + sep + cmd[1])
        data = pSock.recv(999)
        data = single_select(data, pSock)
        if not data:
            return
        os.system('./rsync.sh {0} {1} "{2}"'.format(ip, outDir, data))
        pSock.send('rm' + sep + data);
        pSock.recv(999) #}}}
    elif cmd[0] == 'gets': #{{{
        pSock.send('gets' + sep + cmd[1])
        data = pSock.recv(999)
        data = single_select(data, pSock)
        if data == 'nf' or data == None:
            return
        if data == 'prep':
            print 'Server is preparing files. Please wait.'
        data = pSock.recv(999)
        data = data.split(';')
        data = '" "'.join(data)
        os.system('./rsync.sh {0} {1} "{2}"'.format(ip, outDir, data))
        for f in data.split('" "'):
            pSock.send('rm' + sep + f)
            pSock.recv(999) #}}}
    elif cmd[0] == 'getse':
        pSock.send('getse' + sep + cmd[1])
        data = pSock.recv(999)
        data = single_select(data, pSock)
        if data == 'nf' or data == None:
            return
        if data == 'prep':
            print 'Server is preparing files. Please wait.'
        data = pSock.recv(999)
        data = data.split(';')
        data = '" "'.join(data)
        os.system('./rsync.sh {0} {1} "{2}"'.format(ip, outDir, data))
    else:
        print 'Unrecognized command'
        return
    #}}}

def get_cmd(): #{{{
    cmd = raw_input(user + '@prometheus-media-server> ')
    parse_cmd(cmd) #}}}

get_contents()
print_help()
while (1):
    get_cmd()
os.remove('rp')
