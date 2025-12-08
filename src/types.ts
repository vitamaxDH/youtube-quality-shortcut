/**
 * Shared types for YouTube Quality Shortcut extension
 */

export interface QualityInfo {
    id: string;
    label: string;
    tag?: string;
}

export interface QualityResponse {
    success: boolean;
    currentQuality?: QualityInfo;
    availableQualities?: QualityInfo[];
    newQuality?: QualityInfo;
    error?: string;
}

export interface ChromeMessage {
    command: string;
    quality?: string;
    tabId?: number;
}

export interface ChromeResponse {
    success: boolean;
    currentQuality?: QualityInfo;
    availableQualities?: QualityInfo[];
    newQuality?: QualityInfo;
    error?: string;
}

// Event details for CustomEvents
export interface ControlEventDetail {
    command: string;
    quality?: string;
}

export interface QualityInfoEventDetail {
    requestId: string;
}

export interface QualityResponseEventDetail {
    requestId: string;
    currentQuality: QualityInfo;
    availableQualities: QualityInfo[];
}
// Window message communication types
export const OBS_SOURCE = 'YOUTUBE_QUALITY_EXTENSION_INTERNAL';

export type MessageType =
    | 'GET_QUALITY_INFO'
    | 'QUALITY_INFO_RESPONSE'
    | 'CHANGE_QUALITY'
    | 'SET_SPECIFIC_QUALITY'
    | 'SET_EXTREME_QUALITY';

export interface YoutubeQualityMessage {
    source: typeof OBS_SOURCE;
    type: MessageType;
    payload?: any;
    requestId?: string;
}
