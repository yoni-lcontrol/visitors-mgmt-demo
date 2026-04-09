namespace ScannerService
{
    public class AcuantConstants
    {
        ///////////////////////////////////////////////////////////
        //////////            Scanner types
        ///////////////////////////////////////////////////////////
        public const int CSSN_NONE = 0;
        public const int CSSN_600 = 1;
        public const int CSSN_800 = 2;
        public const int CSSN_800N = 3;
        public const int CSSN_1000 = 4;
        public const int CSSN_2000 = 5;
        public const int CSSN_2000N = 6;
        public const int CSSN_800E = 7;
        public const int CSSN_800EN = 8;
        public const int CSSN_3000 = 9;
        public const int CSSN_4000 = 10;
        public const int CSSN_TWAIN = 11;
        public const int CSSN_5000 = 12;
        public const int CSSN_IDR = 13;  // SnapShell - OCR only
        public const int CSSN_800DX = 14;
        public const int CSSN_800DXN = 15;
        public const int CSSN_FDA = 16;  // SnapShell - OCR + Digimark watermark verification
        public const int CSSN_WMD = 17;   // SnapShell - Digimark watermar verification only
        public const int CSSN_TWN = 18;   // SnapShell - General twain camera
        public const int CSSN_PASS = 19;   // SnapShell - Passport camera
        public const int CSSN_RTE8K = 20;
        public const int CSSN_TWAIN_N = 21;
        public const int CSSN_MAGTEK_STX = 22;
        public const int CSSN_CLBS = 23;
        public const int CSSN_IP = 24;
        public const int CSSN_1000N = 25;
        public const int CSSN_3000DN = 26;
        public const int CSSN_900DX = 27;
        public const int CSSN_RTE9K = 28;
        public const int CSSN_3100 = 29;
        public const int CSSN_3100N = 30;
        public const int CSSN_ROW = 31; // snapshell - raw
        public const int CSSN_PASS_N = 32; // snapshell passport N
        public const int CSSN_R2 = 33;
        //  public const int CSSN_IDR72 = 33;
        public const int CSSN_LIGHT_IDR = 34;
        public const int CSSN_LIGHT_IDR72 = 35;
        public const int CSSN_LIGHT_PAS = 36;
        public const int CSSN_LIGHT_SCN = 37;
        //  public const int CSSN_PASS_DBL = 38;
        public const int CSSN_PASS_R2 = 38;
        public const int CSSN_IDR72N = 39;
        public const int CSSN_PASS_DBL_72N = 40;
        public const int CSSN_IDR72_DBL_DPLX = 41;

        public const int CSSN_R3 = 44;

        public const int CSSN_ID150 = 49;
        public const int CSSN_ID120 = 50;
        public const int ACUANT_ID1200DX = 51;
        public const int ACUANT_ID1200DXN = 52;
        public const int DESKO_ICON = 53;

        public const int ID_ERR_NO_NEXT_COUNTRY = -9;
        public const int ID_ERR_NO_NEXT_STATE = -11;
        public const int ID_ERR_NO_MATCH = -4;
        public const int ID_TRUE = 1;

        public static bool CheckInOutScan(short ScannerType)
        {
            switch (ScannerType)
            {
                case CSSN_800DX:
                    return true;
                case CSSN_800DXN:
                    return true;
                case CSSN_3000DN:
                    return true;
                case CSSN_3000:
                    return true;
                case CSSN_3100:
                    return true;
                case CSSN_3100N:
                    return true;
                case CSSN_2000:
                    return true;
                case CSSN_2000N:
                    return true;
                default:
                    return false;
            }
        }
        public static string GetScannerNameByType(short ScannerType)
        {
            string m_ScannerModel = string.Empty;

            switch (ScannerType)
            {
                case CSSN_600:
                    m_ScannerModel = "ScanShell 600";
                    break;
                case CSSN_800:
                    m_ScannerModel = "ScanShell 800R";
                    break;
                case CSSN_800N:
                    m_ScannerModel = "ScanShell 800NR";
                    break;
                case CSSN_1000:
                    m_ScannerModel = "ScanShell 1000";
                    break;
                case CSSN_2000:
                    m_ScannerModel = "ScanShell 2000R";
                    break;
                case CSSN_2000N:
                    m_ScannerModel = "ScanShell2000 NR";
                    break;
                case CSSN_800E:
                    m_ScannerModel = "ScanShell 800E";
                    break;
                case CSSN_800EN:
                    m_ScannerModel = "ScanShell 800 EN";
                    break;
                case CSSN_3000:
                    m_ScannerModel = "ScanShell 3000";
                    break;
                case CSSN_4000:
                    m_ScannerModel = "Fujistu fi60";
                    break;
                case CSSN_5000:
                    m_ScannerModel = "Bancor";
                    break;
                case CSSN_IDR:
                    m_ScannerModel = "SnapShell IDR";
                    break;
                case CSSN_800DX:
                    m_ScannerModel = "ScanShell 800DX";
                    break;
                case CSSN_800DXN:
                    m_ScannerModel = "ScanShell 800DXN";
                    break;
                case CSSN_FDA:
                    m_ScannerModel = "SnapShell FDA";
                    break;
                case CSSN_WMD:
                    m_ScannerModel = "SnapShell WMD";
                    break;
                case CSSN_TWN:
                    m_ScannerModel = "SnapShell TWN";
                    break;
                case CSSN_PASS:
                    m_ScannerModel = "SnapShell Passport";
                    break;
                case CSSN_RTE8K:
                    m_ScannerModel = "RTE 8000";
                    break;
                case CSSN_TWAIN_N:
                    m_ScannerModel = "Twain N";
                    break;
                case CSSN_MAGTEK_STX:
                    m_ScannerModel = "Magtek STX";
                    break;
                case CSSN_CLBS:
                    m_ScannerModel = "SnapShell Clb.";
                    break;
                case CSSN_IP:
                    m_ScannerModel = "ScanShell IP";
                    break;

                case CSSN_1000N:
                    m_ScannerModel = "ScanShell 1000N";
                    break;

                case CSSN_3000DN:
                    m_ScannerModel = "ScanShell 3000DN";
                    break;

                case CSSN_900DX:
                    m_ScannerModel = "ScanShell 900DX";
                    break;

                case CSSN_ID150:
                    m_ScannerModel = "ID-150";
                    break;

                case CSSN_ID120:
                    m_ScannerModel = "ID-120";
                    break;

                case CSSN_RTE9K:
                    m_ScannerModel = "AT 9000";
                    break;

                case CSSN_3100:
                    m_ScannerModel = "ScanShell 3100";
                    break;
                case CSSN_3100N:
                    m_ScannerModel = "ScanShell 3100N";
                    break;
                case CSSN_R2:
                    m_ScannerModel = "SnapShell R2";
                    break;

                case CSSN_PASS_R2:
                    m_ScannerModel = "SnapShell Passport R2";
                    break;

                case CSSN_LIGHT_IDR:
                    m_ScannerModel = "SnapShell Light";
                    break;
                case CSSN_LIGHT_IDR72:
                    m_ScannerModel = "SnapShell R2 Light";
                    break;
                case CSSN_LIGHT_PAS:
                    m_ScannerModel = "SnapShell Passport Light";
                    break;
                case CSSN_LIGHT_SCN:
                    m_ScannerModel = "SnapShell SCN";
                    break;
                case CSSN_IDR72N:
                    m_ScannerModel = "SnapShell R2 N";
                    break;
                case CSSN_PASS_DBL_72N:
                    m_ScannerModel = "SnapShell Passport dbl N";
                    break;
                case CSSN_IDR72_DBL_DPLX:
                    m_ScannerModel = "SnapShell Duplex";
                    break;

                case CSSN_R3:
                    m_ScannerModel = "SnapShell R3";
                    break;

                case ACUANT_ID1200DX:
                    m_ScannerModel = "ScanShell 1200DX";
                    break;

                case ACUANT_ID1200DXN:
                    m_ScannerModel = "ScanShell 1200DXN";
                    break;

                case DESKO_ICON:
                    m_ScannerModel = "DESKO Icon";
                    break;

                case CSSN_NONE:
                    m_ScannerModel = "None";
                    break;
            }

            return m_ScannerModel;
        }
    }
}
