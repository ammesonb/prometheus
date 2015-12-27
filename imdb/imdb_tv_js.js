series = ''; links = []; c = document.getElementsByTagName('a');
for (i = 0; i < c.length; i++) {a = c[i]; if (a.getAttribute('itemprop') === 'name') {links.push(a.href.split('/tt')[1].split('/')[0] + '#' + a.title)}}
links.join('\n' + series + ',');
