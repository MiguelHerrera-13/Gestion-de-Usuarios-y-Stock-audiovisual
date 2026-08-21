const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function hashPassword(password) {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  } catch (error) {
    console.error('Error al generar hash:', error);
    throw error;
  }
}

async function main() {
  rl.question('Ingresa la contraseña a hashear: ', async (password) => {
    if (!password) {
      console.log('❌ Debes ingresar una contraseña');
      rl.close();
      return;
    }

    console.log('\n🔐 Generando hash...\n');
    
    const hash = await hashPassword(password);
    
    console.log('✅ Hash generado exitosamente:');
    console.log('─'.repeat(80));
    console.log(hash);
    console.log('─'.repeat(80));
    console.log('\n📋 Query SQL de ejemplo:');
    console.log(`INSERT INTO usuario (nombre, apellido, email, password, rol_id) VALUES 
('Nombre', 'Apellido', 'email@ejemplo.com', '${hash}', 1);`);
    console.log('\n');
    
    rl.close();
  });
}
if (require.main === module) {
  main();
}

module.exports = { hashPassword };