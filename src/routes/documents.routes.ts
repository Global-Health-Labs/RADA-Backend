import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import crypto from 'crypto';
import config from '../config';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
    }
});

// Upload document
router.post('/:experimentId/upload', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const { experimentId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Check if experiment exists
        const experiment = await db.query(
            'SELECT * FROM experimental_plans WHERE id = $1',
            [experimentId]
        );

        if (experiment.rows.length === 0) {
            return res.status(404).json({ message: 'Experiment not found' });
        }

        // Generate secure filename
        const fileExtension = file.originalname.split('.').pop();
        const secureFilename = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;

        // Calculate file hash
        const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

        // Check if file already exists
        const existingDoc = await db.query(
            'SELECT * FROM documents WHERE experiment_plan_id = $1 AND file_hash = $2',
            [experimentId, fileHash]
        );

        if (existingDoc.rows.length > 0) {
            return res.status(400).json({ message: 'File already exists' });
        }

        // Upload to S3
        const uploadParams = {
            Bucket: config.aws.bucketName,
            Key: secureFilename,
            Body: file.buffer,
            ContentType: file.mimetype,
            ContentDisposition: `attachment; filename="${file.originalname}"`
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const fileUrl = `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${secureFilename}`;

        // Save document metadata to database
        const newDoc = await db.query(
            `INSERT INTO documents 
            (experiment_plan_id, original_file_name, secure_file_name, s3_url, content_type, file_size, file_hash) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`,
            [
                experimentId,
                file.originalname,
                secureFilename,
                fileUrl,
                file.mimetype,
                file.size,
                fileHash
            ]
        );

        res.status(200).json({
            message: 'File uploaded successfully',
            document: newDoc.rows[0]
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Get documents for experiment
router.get('/experiment/:experimentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { experimentId } = req.params;

        const experiment = await db.query(
            'SELECT * FROM experimental_plans WHERE id = $1',
            [experimentId]
        );

        if (experiment.rows.length === 0) {
            return res.status(404).json({ message: 'Experiment not found' });
        }

        const documents = await db.query(
            'SELECT * FROM documents WHERE experiment_plan_id = $1 ORDER BY created_at DESC',
            [experimentId]
        );

        res.json(documents.rows);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
    }
});

// Get single document
router.get('/:documentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { documentId } = req.params;

        const document = await db.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (document.rows.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        res.json(document.rows[0]);
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({ message: 'Failed to fetch document', error: error.message });
    }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { documentId } = req.params;

        const document = await db.query(
            'SELECT * FROM documents WHERE id = $1',
            [documentId]
        );

        if (document.rows.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Delete from S3
        const deleteParams = {
            Bucket: config.aws.bucketName,
            Key: document.rows[0].secure_file_name
        };

        await s3Client.send(new DeleteObjectCommand(deleteParams));

        // Delete from database
        await db.query('DELETE FROM documents WHERE id = $1', [documentId]);

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ message: 'Failed to delete document', error: error.message });
    }
});

export default router;
