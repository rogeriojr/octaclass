import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const teacherPassword = await bcrypt.hash('123456', 10);
  const teacher = await prisma.user.upsert({
    where: { email: 'professor@escola.com' },
    update: {},
    create: {
      name: 'Professor Teste',
      email: 'professor@escola.com',
      password: teacherPassword,
      role: 'teacher'
    }
  });

  console.log('✅ Created teacher:', teacher.email);

  const studentPassword = await bcrypt.hash('123456', 10);
  const student = await prisma.user.upsert({
    where: { email: 'aluno@escola.com' },
    update: {},
    create: {
      name: 'Aluno Teste',
      email: 'aluno@escola.com',
      password: studentPassword,
      role: 'student'
    }
  });

  console.log('✅ Created student:', student.email);

  console.log('\n📋 Test Credentials:');
  console.log('Teacher: professor@escola.com / 123456');
  console.log('Student: aluno@escola.com / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
