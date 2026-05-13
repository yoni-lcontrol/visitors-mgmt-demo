import { VisitorType } from "../enum/visitor-type.enum";

export interface VisitResponse {
    ok: boolean;
    visit: {
        visitId: number;
        visitName: string;
        fromDate: string;
        toDate: string;
        siteId: number;
        departmentId: number | null;
        visitorType: VisitorType;
        driverType: number | null;
        comment: string | null;
        isExternal: boolean;
    };
    visitor: {
        visitorId: number;
        visitId: number;
        firstName: string;
        lastName: string;
        personId: string | null;
        carNumber: string | null;
        accessLevelId: number | null;
        visitCode: string | null;
        phone: string | null;
        email: string | null;
        image: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        rejectDate: string | null;
        approveDate: string | null;
        visitorStatus: number;
    };
}