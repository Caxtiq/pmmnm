/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getDatabase } from '../mongodb';
import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string;
  password: string; // hashed
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

const COLLECTION_NAME = 'users';

export async function createUser(user: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  
  const now = new Date();
  const result = await collection.insertOne({
    ...user,
    createdAt: now,
    updatedAt: now,
  });
  
  return result.insertedId.toString();
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  return await collection.findOne({ username });
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  return await collection.findOne({ _id: new ObjectId(id) });
}

export async function updateUser(id: string, updates: Partial<Omit<User, '_id' | 'createdAt'>>): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  
  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    { 
      $set: { 
        ...updates,
        updatedAt: new Date()
      }
    }
  );
  
  return result.modifiedCount > 0;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  return await collection.find({}).toArray();
}

export function sanitizeUser(user: User): SafeUser {
  return {
    id: user._id!.toString(),
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function ensureUserIndexes(): Promise<void> {
  const db = await getDatabase();
  const collection = db.collection<User>(COLLECTION_NAME);
  await collection.createIndex({ username: 1 }, { unique: true });
}
