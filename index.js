import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import db, { initDb } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build Fastify options and enable HTTPS if SSL paths provided in .env
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

const fastifyOptions = { logger: true };
if (sslKeyPath && sslCertPath) {
  try {
    fastifyOptions.https = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
      allowHTTP1: true
    };
    console.log('Avviando con HTTPS usando i certificati:', sslKeyPath, sslCertPath);
  } catch (err) {
    console.error('Impossibile leggere i file SSL:', err.message);
  }
}

const fastify = Fastify(fastifyOptions);

// Admin password from .env
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Initialize database
await initDb();

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/'
});

// Generate random invite code
const generateInviteCode = () => {
  return randomBytes(8).toString('hex').toUpperCase();
};

// Admin login endpoint
fastify.post('/api/admin/login', async (request, reply) => {
  const { password } = request.body;
  
  if (password === ADMIN_PASSWORD) {
    reply.code(200);
    return { success: true, token: 'authenticated' };
  } else {
    reply.code(401);
    return { error: 'Password non valida' };
  }
});

// Middleware to check admin authentication
const checkAdminAuth = async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return reply.send({ error: 'Non autorizzato' });
  }
};

// Admin: Create new invite
fastify.post('/api/admin/create-invite', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  const { name } = request.body;
  const code = generateInviteCode();

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO invites (code, name) VALUES (?, ?)',
      [code, name],
      function(err) {
        if (err) {
          reply.code(400);
          resolve({ error: 'Errore nella creazione dell\'invito: ' + err.message });
        } else {
          resolve({ id: this.lastID, code, name });
        }
      }
    );
  });
});

// Get invite details (validate invite)
fastify.get('/api/invite/:code', async (request, reply) => {
  const { code } = request.params;

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM invites WHERE code = ?',
      [code],
      (err, row) => {
        if (err) {
          reply.code(500);
          resolve({ error: err.message });
        } else if (!row) {
          reply.code(404);
          resolve({ error: 'Invito non trovato' });
        } else if (row.status === 'responded') {
          reply.code(400);
          resolve({ error: 'Questo invito è già stato utilizzato' });
        } else if (row.status === 'canceled') {
          reply.code(400);
          resolve({ error: 'Questo invito è stato revocato' });
        } else {
          resolve(row);
        }
      }
    );
  });
});

// Submit response to invite
fastify.post('/api/invite/:code/response', async (request, reply) => {
  const { code } = request.params;
  const { participating, rosmarino, eating, alcohol, sleep } = request.body;

  return new Promise((resolve, reject) => {
    // First get the invite
    db.get(
      'SELECT id, status FROM invites WHERE code = ?',
      [code],
      (err, invite) => {
        if (err) {
          reply.code(500);
          resolve({ error: err.message });
        } else if (!invite) {
          reply.code(404);
          resolve({ error: 'Invito non trovato' });
        } else if (invite.status === 'responded') {
          reply.code(400);
          resolve({ error: 'Questo invito è già stato utilizzato' });
        } else {
          // Insert response
          db.run(
            `INSERT INTO responses (invite_id, participating, rosmarino, eating, alcohol, sleep)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [invite.id, participating ? 1 : 0, rosmarino ? 1 : 0, eating ? 1 : 0, alcohol ? 1 : 0, sleep ? 1 : 0],
            function(err) {
              if (err) {
                reply.code(400);
                resolve({ error: 'Errore nell\'invio della risposta: ' + err.message });
              } else {
                // Update invite status to responded
                db.run(
                  'UPDATE invites SET status = ? WHERE id = ?',
                  ['responded', invite.id],
                  (err) => {
                    if (err) {
                      reply.code(400);
                      resolve({ error: 'Errore nell\'aggiornamento dello stato: ' + err.message });
                    } else {
                      resolve({ success: true, responseId: this.lastID });
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  });
});

// Get invite statistics
fastify.get('/api/stats', async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        COUNT(*) as total_invites,
        SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as responded_count,
        SUM(CASE WHEN status = 'responded' AND r.participating = 1 THEN 1 ELSE 0 END) as participating_count
       FROM invites i
       LEFT JOIN responses r ON i.id = r.invite_id`,
      (err, rows) => {
        if (err) {
          reply.code(500);
          resolve({ error: 'Errore nel recupero delle statistiche: ' + err.message });
        } else {
          const row = rows[0];
          resolve({
            total_invites: row.total_invites || 0,
            responded: row.responded_count || 0,
            participating: row.participating_count || 0,
            pending: (row.total_invites || 0) - (row.responded_count || 0)
          });
        }
      }
    );
  });
});

// Get public configuration
fastify.get('/api/config', async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM config WHERE id = 1',
      (err, row) => {
        if (err) {
          reply.code(500);
          resolve({ error: 'Errore nel recupero della configurazione: ' + err.message });
        } else {
          resolve(row || {});
        }
      }
    );
  });
});

// Admin: Get all invites and responses
fastify.get('/api/admin/invites', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT i.*, r.id as response_id, r.participating, r.rosmarino, r.eating, r.alcohol, r.sleep, r.submitted_at
       FROM invites i
       LEFT JOIN responses r ON i.id = r.invite_id
       ORDER BY i.created_at DESC`,
      (err, rows) => {
        if (err) {
          reply.code(500);
          resolve({ error: 'Errore nel recupero degli inviti: ' + err.message });
        } else {
          resolve(rows);
        }
      }
    );
  });
});

// Admin: Save configuration
fastify.post('/api/admin/config', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  const { eventName, eventTime, eventLocation, serviceFood, serviceSleep, serviceRosmarino, serviceAlcohol } = request.body;

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO config (id, eventName, eventTime, eventLocation, serviceFood, serviceSleep, serviceRosmarino, serviceAlcohol, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [eventName, eventTime, eventLocation, serviceFood ? 1 : 0, serviceSleep ? 1 : 0, serviceRosmarino ? 1 : 0, serviceAlcohol ? 1 : 0],
      function(err) {
        if (err) {
          reply.code(400);
          resolve({ error: 'Errore nel salvare la configurazione: ' + err.message });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});

// Admin: Get configuration
fastify.get('/api/admin/config', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM config WHERE id = 1',
      (err, row) => {
        if (err) {
          reply.code(500);
          resolve({ error: 'Errore nel recupero della configurazione: ' + err.message });
        } else {
          resolve(row || {});
        }
      }
    );
  });
});

// Admin: Revoke invite
fastify.post('/api/admin/revoke/:code', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  const { code } = request.params;

  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE invites SET status = ? WHERE code = ? AND status = ?',
      ['canceled', code, 'pending'],
      function(err) {
        if (err) {
          reply.code(400);
          resolve({ error: 'Errore nella revoca dell\'invito: ' + err.message });
        } else if (this.changes === 0) {
          reply.code(404);
          resolve({ error: 'Invito non trovato o già utilizzato' });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});

// Admin: Reset everything
fastify.post('/api/admin/reset', async (request, reply) => {
  const password = request.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    reply.code(401);
    return { error: 'Non autorizzato' };
  }

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM responses', (err) => {
        if (err) {
          reply.code(400);
          resolve({ error: 'Errore nel reset: ' + err.message });
          return;
        }
        db.run('DELETE FROM invites', (err) => {
          if (err) {
            reply.code(400);
            resolve({ error: 'Errore nel reset: ' + err.message });
            return;
          }
          db.run('DELETE FROM config', (err) => {
            if (err) {
              reply.code(400);
              resolve({ error: 'Errore nel reset: ' + err.message });
            } else {
              resolve({ success: true });
            }
          });
        });
      });
    });
  });
});

const start = async () => {
  try {
    const port = process.env.PORT ? Number(process.env.PORT) : 8080;
    const host = '0.0.0.0';
    await fastify.listen({ host, port });

    const protocol = fastifyOptions.https ? 'https' : 'http';
    const domain = process.env.DOMAIN || 'localhost';
    console.log(`Server in esecuzione su ${protocol}://${domain}:${port}`);
  } catch (err) {
    fastify.log.error('Errore nell\'avvio del server:', err);
    process.exit(1);
  }
};

start();
