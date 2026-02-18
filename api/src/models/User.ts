export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher';
  createdAt: Date;
}

export class UserDatabase {
  private static users: User[] = [
    {
      id: 'teacher_seed',
      name: 'Professor Admin',
      email: 'professor@escola.com',
      password: '123456',
      role: 'teacher',
      createdAt: new Date()
    }
  ];

  static createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...user,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  static findByEmail(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }

  static findById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  static getAllUsers(): User[] {
    return this.users;
  }

  static deleteUser(id: string): boolean {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }
}
