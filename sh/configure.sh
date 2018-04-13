#!/bin/sh
# this script for configure app using suitable config for each env
# example for dev env : 
#	sh config.sh dev
# this command will do :
#	cp config.dev.json config.php
# run this script on root project

info () {
	echo "INFO : " $1
}
 
error () {
	echo "ERROR!!! : " $1
}

info "starting configuring app..."

#check parameter
if [ "$#" -ne 1 ]; then
    error "Error input env"
    exit 1
fi

env=$1

#check file
conf_app=./config.json
env_conf_app=./config."$env".json
if [ ! -f "$env_conf_app" ]; then
    echo "$env_conf_app" not found
    exit 2
fi

#copy env config file to used config file
info "copying "$env_conf_app""
cp $env_conf_app $conf_app

info "finish configuring app..."
