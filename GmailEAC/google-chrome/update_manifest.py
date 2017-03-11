#!/usr/bin/python

import re, sys
from argparse import ArgumentParser


def read_lines():
	try:
		while True:
			yield raw_input()
	except EOFError:
		pass

def iter_file(filename=None):
	def file_iterator():
		with open(filename, 'r') as f:
			for line in f:
				yield line.rstrip('\n')
		
	return file_iterator() if filename else read_lines()



def create_key_re(key):
	return re.compile('(\s*"{}"\s*:\s*)"(.*)"(.*)'.format(key), re.I)

def update_line(line, regex, new_value):
	m = regex.match(line)
	if not m: line
	return regex.sub('\g<1>"{}"\g<3>'.format(new_value), line)

def create_composit_updater(options):
	def create_updater(key, value):
		regex = create_key_re(key)
		return lambda line: update_line(line, regex, value)
	
	updaters = []
	
	if options.name is not None:
		updaters.append(create_updater('name', options.name.strip()))

	if options.version is not None:
		updaters.append(create_updater('version', options.version.strip()))
		updaters.append(create_updater('version_name', options.version.strip() + ' alpha'))

	def wrapper(line):
		for update in updaters:
			line = update(line)
		return line

	return wrapper



parser = ArgumentParser()
parser.add_argument('-f', dest='file')
parser.add_argument('--name')
parser.add_argument('--version')

options = parser.parse_args()


updater = create_composit_updater(options)
result = map(updater, iter_file(options.file))

if result[-1]: result.append('') # add empty line
output = '\n'.join(result)


if options.file:
	with open(options.file, 'w') as f:
		f.write(output)

else:
	sys.stdout.write(output)
	sys.stdout.flush()

