const serialport = require('serialport')
var {shell} = require('electron')

var flightcontrol_configurator_version ='v2.0';
let isFlasherTab=0;
var lastPortCount = 0;


function isExistOption(id,value) {  
    var isExist = false;  
    var count = $('#'+id).find('option').length;  

      for(var i=0;i<count;i++)     
      {     
         if($('#'+id).get(0).options[i].value == value)     
        {     
            isExist = true;     
            break;     
        }     
    }     
    return isExist;  
} 

function addOptionValue(id,value,text) {  
    if(!isExistOption(id,value)){$('#'+id).append("<option value="+value+">"+text+"</option>");}      
} 

async function listSerialPorts() {
    await serialport.list().then((ports, err) => {
        if(ports.length!==lastPortCount){
            $('#port option').each(function(){ 
                $(this).remove(); 
            } );
        }

        for (let i = 0; i < ports.length; i++) {            
            if(ports[i].productId == "5740" && ((ports[i].vendorId == "0483") || (ports[i].vendorId == "0493")))
            {
                addOptionValue('port',i,ports[i].path);
            }
                
        }
        lastPortCount = ports.length;
    })
}

setTimeout(function listPorts() {
    listSerialPorts();
    setTimeout(listPorts, 500);
  }, 500);


  mavlinkSend = function(writedata){
    port.write(writedata, function (err) {
        if (err) {
            return console.log('Error on write: ', err.message);
        }
    });
  } 


window.onload=function(){
    
    let Unable_to_find_serial_port = document.getElementById("Unable_to_find_serial_port");
    Unable_to_find_serial_port.onclick = function(e){
          e.preventDefault();
          if(i18n.selectedLanguage == 'zh_CN'){
            shell.openExternal("https://github.com/BETAFPV/BETAFPV_Configurator/blob/master/docs/UnableToFindSerialPort_CN.md");
          }else{
            shell.openExternal("https://github.com/BETAFPV/BETAFPV_Configurator/blob/master/docs/UnableToFindSerialPort_EN.md");
          }
          
        }

    $('label[id="flightcontrol_configurator_version"]').text(flightcontrol_configurator_version);
    $('div.connect_controls a.connect').click(function () {
        if (GUI.connect_lock != true) { 
            const thisElement = $(this);
            const clicks = thisElement.data('clicks');
            
            const toggleStatus = function() {
                thisElement.data("clicks", !clicks);
            };

            GUI.configuration_loaded = false;

            const selected_baud = parseInt($('div#port-picker #baud').val());

            let COM = ($('div#port-picker #port option:selected').text());


            port = new serialport(COM, {
                baudRate: parseInt(selected_baud),
                dataBits: 8,
                parity: 'none',
                stopBits: 1
            });
            
            
            //open事件监听
            port.on('open', () =>{
                setup.mavlinkConnected = false;       
                GUI.connect_lock = true;
                $('div#connectbutton a.connect').addClass('active');     
                
                if(isFlasherTab ==0)
                {
                    FC.resetState();
                    $('div#connectbutton div.connect_state').text(i18n.getMessage('connecting')).addClass('active');
                    setTimeout(() => {
                          if(setup.mavlinkConnected==true){
                            $('#tabs ul.mode-disconnected').hide();
                            $('#tabs ul.mode-connected').show();
                            $('#tabs ul.mode-connected li a:first').click();
                            $('div#connectbutton div.connect_state').text(i18n.getMessage('disconnect')).addClass('active');
                          }else{
                            port.close();
                            GUI.connect_lock = true;
                            GUI.interval_remove('mavlink_heartbeat');
                            $('div#connectbutton a.connect').removeClass('active');
                            const options = {
                                type: 'warning',
                                buttons: [ i18n.getMessage('Confirm')],
                                defaultId: 0,
                                title: i18n.getMessage('warningTitle'),
                                message: i18n.getMessage('NoConfigurationReceived'),
                                detail: i18n.getMessage('NoValidPort'),
                                noLink:true,
                            };
                            let WIN      = remote.getCurrentWindow();
                            dialog.showMessageBoxSync(WIN, options);    
                          }
                    }, 1000);
                    GUI.interval_add('mavlink_heartbeat', mavlink_msg_heartbeat, 1000, true);
                }
                else{
                    $('div#connectbutton div.connect_state').text(i18n.getMessage('flashTab')).addClass('active');
                }                     
            });

            //close事件监听
            port.on('close', () =>{
                if(isFlasherTab ==0){
                    console.log("close");
                    GUI.connect_lock = false;
                    GUI.interval_remove('mavlink_heartbeat');
                    GUI.interval_remove('display_Info');
                    GUI.interval_remove('setup_data_pull_fast');
                    $('#tabs ul.mode-connected').hide();
                    $('#tabs ul.mode-disconnected').show();
                    $('#tabs ul.mode-disconnected li a:first').click();
                    $('div#connectbutton a.connect').removeClass('active');
                    $('div#connectbutton div.connect_state').text(i18n.getMessage('connect'));
                }else{
                    GUI.connect_lock = false;
                    $('div#connectbutton a.connect').removeClass('active');
                    $('div#connectbutton div.connect_state').text(i18n.getMessage('connect'));

                }
                
            });

            //data事件监听
            port.on('data', data => {
                if(isFlasherTab)
                {
                    firmware_flasher.parseData(data);
                }
                else
                {
                    mavlinkParser.parseBuffer(data);
                }
            });

            //error事件监听
            port.on('error',function(err){
                console.log('Error: ',err.message);
                GUI.interval_remove('mavlink_heartbeat');
                GUI.interval_remove('display_Info');
                GUI.interval_remove('setup_data_pull_fast');
                $('div#connectbutton a.connect').removeClass('active');
                $('div#connectbutton div.connect_state').text(i18n.getMessage('connect'));

                $('#tabs ul.mode-disconnected li a:first').click();
                GUI.connect_lock = false;
            });
        }
        else
        {
            port.close();
            
       
        }
    });


    function mavlink_msg_heartbeat(){
       let msg = new  mavlink10.messages.heartbeat(0,1);
       let buffer = msg.pack(msg);
       mavlinkSend(buffer);
    }
    
    const ui_tabs = $('#tabs > ul');
    $('a', ui_tabs).click(function () {
        if ($(this).parent().hasClass('active') === false && !GUI.tab_switch_in_progress) { 
            const self = this;
            const tabClass = $(self).parent().prop('class');

            const tabRequiresConnection = $(self).parent().hasClass('mode-connected');

            const tab = tabClass.substring(4);
            const tabName = $(self).text();

            GUI.tab_switch_in_progress = true;
            isFlasherTab = 0;
            tab_switch_cleanup();

            function tab_switch_cleanup () {
                if ($('div#flashbutton a.flash_state').hasClass('active') && $('div#flashbutton a.flash').hasClass('active')) {
                    $('div#flashbutton a.flash_state').removeClass('active');
                    $('div#flashbutton a.flash').removeClass('active');
                }
                // disable previously active tab highlight
                $('li', ui_tabs).removeClass('active');

                // Highlight selected tab
                $(self).parent().addClass('active');

                // detach listeners and remove element data
                const content = $('#content');
                content.empty();

                // display loading screen
                $('#cache .data-loading').clone().appendTo(content);
                // $('div#connectbutton a.connect').addClass('disabled');
                

                if($('div#flashbutton a.flash').hasClass('disabled'))
                {
                    $('div#flashbutton a.flash').removeClass('disabled');
                }
                
                function content_ready() {
                    GUI.tab_switch_in_progress = false;
                }

                switch (tab) {
                    case 'landing':
                        landing.initialize(content_ready);
                        break;
                    case 'firmware_flasher':                     
                        $('div#connectbutton a.connect').removeClass('disabled');
                        $('div#flashbutton a.flash').addClass('disabled');
                        firmware_flasher.initialize(content_ready);
                        isFlasherTab = 1;            
                        break;
                    case 'setup':
                        setup.initialize(content_ready);
                        break; 
                    case 'receiver':
                        receiver.initialize(content_ready);
                        break;
                    case 'motors':
                        motors.initialize(content_ready);
                        break;     
                    case 'pid_tuning':
                        pid_tuning.initialize(content_ready);
                        break; 
                    case 'sensors':
                        sensors.initialize(content_ready);
                        break;  
                    case 'show':
                        show.initialize(content_ready);
                        break;
                    case 'calibrate':
                        calibrate.initialize(content_ready);
                        break;        
                    default:
                        console.log(`Tab not found: ${tab}`);
                }
            }
        }
    });
    i18n.init();
    $('#tabs ul.mode-disconnected li a:first').click();

    //i18n初始化结束后延时一小会儿加载本地json语言包
    setTimeout(function loadLanguage() {
        i18next.changeLanguage(i18n.Storage_language);
        if(i18n.Storage_language == 'en'){
            document.getElementById("wechat_facebook_logo_src_switch").src = "./src/images/flogo_RGB_HEX-1024.svg";
        }else if(i18n.Storage_language == "zh_CN"){
            document.getElementById("wechat_facebook_logo_src_switch").src = "./src/images/wechat_icon.png";
        }
    }, 10);
}