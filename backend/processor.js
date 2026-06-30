module.exports = {
  generateDriverData,
};

function generateDriverData(userContext, events, done) {
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  const randomPlate = `51C-${Math.floor(Math.random() * 90000) + 10000}`;
  
  userContext.vars.vendorName = `Vendor ${randomStr}`;
  userContext.vars.driverName = `Driver ${randomStr}`;
  userContext.vars.driverPhone = `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
  userContext.vars.vehiclePlate = randomPlate;
  
  return done();
}
