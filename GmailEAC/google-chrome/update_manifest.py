#!/usr/bin/python

import re


def read_lines():
	try:
		while True:
			yield raw_input()
	except EOFError:
		pass


def create_re(key):
	return 


NAME_RE = re.compile(r'(\s*"name"\s*:\s*)"(.*)"(.*)', re.I)


for line in read_lines():
	m = NAME_RE.match(line)
	
	if not m:
		print line
		continue

	name = m.group(2) + ' Dev'
	print NAME_RE.sub('\g<1>"{}"\g<3>'.format(name), line)


