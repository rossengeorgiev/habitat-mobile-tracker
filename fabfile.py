from fabric.api import *

env.use_ssh_config = True
env.hosts = ['kraken.habhub.org']

def stage_master():
    result = local('git branch', capture=True);

    for line in result.split('\n'):
        if line[0] == '*':
            branch = line.split(' ')[1]
            break

    if branch == "master":
        print "Already on master branch."
        return

    local("git checkout master")
    local("git merge %s" % branch)
    local("git checkout %s" % branch)
    local("git push -f origin")
    local("git push -f ukhas")

def deploy():
    wd = "/var/www/habitat/mobile-tracker/"

    with settings(warn_only=True):
        if run("test -d %s" % wd).failed:
            print "Cannot locate %s" % wd
            return

    with cd(wd):
        run("git reset --hard")
        run("git pull")
        run("./build.sh")

def build():
    local("./build.sh")
