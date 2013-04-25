from fabric.api import *

def compile_coffee():
    local("/usr/lib/node_modules/coffee-script/bin/coffee -b -c -o js/ coffee/*.coffee")

def build():
    compile_coffee()

def clean():
    local("rm -f js/*js")
