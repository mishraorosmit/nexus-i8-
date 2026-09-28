import { Request, Response } from 'express';
import { eidService } from './eid.service.ts';

export async function getAllEidMembers(req: Request, res: Response): Promise<void> {
  try {
    const result = await eidService.getAllMembers();
    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
      },
      error: null,
    });
  } catch (error) {
    console.error('[E-ID Controller] Failed to list members:', error);
    res.status(500).json({
      success: false,
      data: null,
      meta: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while fetching E-ID cards.',
      },
    });
  }
}

export async function getEidMemberByIdentifier(req: Request, res: Response): Promise<void> {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      res.status(400).json({
        success: false,
        data: null,
        meta: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Member identifier is required.',
        },
      });
      return;
    }

    const member = await eidService.getMemberByIdentifier(identifier);
    if (!member) {
      res.status(404).json({
        success: false,
        data: null,
        meta: null,
        error: {
          code: 'NOT_FOUND',
          message: `NEXUS E-ID card for identifier "${identifier}" could not be found.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: member,
      meta: null,
      error: null,
    });
  } catch (error) {
    console.error('[E-ID Controller] Failed to fetch member by identifier:', error);
    res.status(500).json({
      success: false,
      data: null,
      meta: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while resolving E-ID card.',
      },
    });
  }
}

export async function getEidMemberBySlugAndId(req: Request, res: Response): Promise<void> {
  try {
    const { slug, uniqueId } = req.params;
    if (!slug || !uniqueId) {
      res.status(400).json({
        success: false,
        data: null,
        meta: null,
        error: {
          code: 'BAD_REQUEST',
          message: 'Both member slug and unique ID are required.',
        },
      });
      return;
    }

    const member = await eidService.getMemberBySlugAndUniqueId(slug, uniqueId);
    if (!member) {
      res.status(404).json({
        success: false,
        data: null,
        meta: null,
        error: {
          code: 'NOT_FOUND',
          message: `NEXUS E-ID card for slug "${slug}" and ID "${uniqueId}" could not be found.`,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: member,
      meta: null,
      error: null,
    });
  } catch (error) {
    console.error('[E-ID Controller] Failed to fetch member by slug and uniqueId:', error);
    res.status(500).json({
      success: false,
      data: null,
      meta: null,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while resolving E-ID card.',
      },
    });
  }
}
