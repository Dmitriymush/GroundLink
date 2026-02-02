// Script to set localStorage values
const storageValues = {
  'doneControllChannel': 'CH12',
  'mixes': '[{"min":0,"max":100,"input":"CH1","output":"CH1","reverse":false},{"min":0,"max":100,"input":"CH2","output":"CH2","reverse":false},{"min":0,"max":100,"input":"CH3","output":"CH3","reverse":false},{"min":0,"max":100,"input":"CH4","output":"CH4","reverse":false},{"min":0,"max":100,"input":"CH5","output":"CH5","reverse":false},{"min":0,"max":100,"input":"CH6","output":"CH6","reverse":false},{"min":0,"max":100,"input":"CH7","output":"CH7","reverse":false},{"min":0,"max":100,"input":"CH8","output":"CH8","reverse":false},{"min":0,"max":100,"input":"CH9","output":"CH9","reverse":false},{"min":0,"max":100,"input":"CH10","output":"CH10","reverse":false},{"min":0,"max":100,"input":"CH11","output":"CH11","reverse":false},{"min":0,"max":100,"input":"CH12","output":"CH12","reverse":false},{"min":0,"max":100,"input":"CH13","output":"CH13","reverse":false},{"min":0,"max":100,"input":"CH14","output":"CH14","reverse":false},{"min":0,"max":100,"input":"CH15","output":"CH15","reverse":false},{"min":0,"max":100,"input":"CH5","output":"CH16","reverse":true}]',
  'vulik-host': 'localhost',
  'doneControllEnable': 'true',
  'secondary-jr-settings': '{"baudRate":115200,"refreshRate":50}',
  'own-ip': '10.6.0.6',
  'connection-settings': '[{"hostIp":"10.6.0.2","operatorIp":"10.6.0.6","mainServerPort":3003,"relayServerPort":8000,"rpanionServerPort":3000,"port":27015,"secondPort":27016,"name":"PL","id":"843b8a29-1fdc-456a-a91a-564e6b441977"},{"hostIp":"10.6.0.10","operatorIp":"10.6.0.6","mainServerPort":3003,"relayServerPort":8000,"rpanionServerPort":3000,"port":27015,"secondPort":27016,"name":"PL_CAMERA_LTE_1","vulikHost":"localhost","vulikPort":27017,"initiatorServerEndpoint":"38.180.110.222","initiatorServerToken":"57410e40854a7d8bc22ef2742db07cf9","id":"61bfe79d-9ee7-4ee5-8e7e-ca98dda3433a"},{"hostIp":"10.6.0.10","operatorIp":"10.6.0.6","mainServerPort":3003,"relayServerPort":8000,"rpanionServerPort":3000,"port":27015,"secondPort":27016,"name":"PL_CAMERA_LTE_2","vulikHost":"localhost","vulikPort":27017,"initiatorServerEndpoint":"38.180.208.36","initiatorServerToken":"57410e40854a7d8bc22ef2742db07cf9","id":"0d6f2b71-9484-4552-a1c5-cd0f4f71cbcf"}]',
  'second-port': '27016',
  'selected-connection': '{"hostIp":"10.6.0.10","operatorIp":"10.6.0.6","mainServerPort":3003,"relayServerPort":8000,"rpanionServerPort":3000,"port":27015,"secondPort":27016,"name":"PL_CAMERA_LTE_2","vulikHost":"localhost","vulikPort":27017,"initiatorServerEndpoint":"38.180.208.36","initiatorServerToken":"57410e40854a7d8bc22ef2742db07cf9","id":"0d6f2b71-9484-4552-a1c5-cd0f4f71cbcf"}',
  'doneControllValue': '0',
  'host': '10.6.0.10',
  'vulik-port': '27017',
  'initiator-server-endpoint': '38.180.208.36',
  'initiator-server-token': '57410e40854a7d8bc22ef2742db07cf9',
  'main-jr-settings': '{"baudRate":115200,"refreshRate":50}',
  'port': '27015'
};

// Function to set all values
(function setLocalStorage() {
  Object.entries(storageValues).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  console.log('Local storage values have been set successfully:', storageValues);
})();
