from fabric.api import *

def dothis(cmd):
    if len(env.hosts) == 0:
        local(cmd)
    else:
        run(cmd)

def compile_coffee():
    dothis("/usr/local/lib/node_modules/coffee-script/bin/coffee -b -c -o js/ coffee/*.coffee")

def build():
    compile_coffee()

def clean():
    dothis("rm -f js/*js")
