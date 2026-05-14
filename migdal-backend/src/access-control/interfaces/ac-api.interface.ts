/** Cardholder representation on the remote AC server. */
export interface RemoteCardholder {
    id?: string;
    firstName: string;
    lastName: string;
    personId: string;
    cardNumber?: string;
    accessLevelNames?: string[];
    pin?: string;
    fromDate?: string;
    toDate?: string;
    isVisitor?: boolean;
    active?: boolean;
    licensePlate?: string;
    metadata?: Record<string, unknown>;
}

/** Response from remote AC server after mutating a cardholder. */
export interface RemoteCardholderResponse {
    success: boolean;
    cardholderId?: string;
    message?: string;
}

/** Batch result for download operations. */
export interface RemoteCardholderListResponse {
    cardholders: RemoteCardholder[];
    totalCount: number;
}

/** Query params for filtering cardholders on the remote AC server. */
export interface CardholderQueryParams {
    search?: string;
    accessLevelName?: string;
    isVisitor?: boolean;
    active?: boolean;
    page?: number;
    limit?: number;
}
