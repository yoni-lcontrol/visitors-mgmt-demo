using System;
using System.IO;

namespace ScannerService
{
    public class AcuantUtilities
    {
        public static int GetRegionIntValue(string region)
        {
            switch (region)
            {
                case "United States":
                    return 0;
                case "Australia":
                    return 4;
                case "Asia":
                    return 5;
                case "Canada":
                    return 1;
                case "America":
                    return 2;
                case "Europe":
                    return 3;
                case "Africa":
                    return 7;
                case "General doc.":
                    return 6;
                default:
                    return -1;
            }
        }

        public static bool IsCalibrateButtonRequired(int scanner_type)
        {
            bool ret = false;
            if (scanner_type == AcuantConstants.CSSN_600 || scanner_type == AcuantConstants.CSSN_800 || scanner_type == AcuantConstants.CSSN_800N || scanner_type == AcuantConstants.CSSN_1000 || scanner_type == AcuantConstants.CSSN_2000 || scanner_type == AcuantConstants.CSSN_2000N || scanner_type == AcuantConstants.CSSN_800E || scanner_type == AcuantConstants.CSSN_800EN || scanner_type == AcuantConstants.CSSN_3000 || scanner_type == AcuantConstants.CSSN_800DX || scanner_type == AcuantConstants.CSSN_800DXN || scanner_type == AcuantConstants.CSSN_IP || scanner_type == AcuantConstants.CSSN_1000N || scanner_type == AcuantConstants.CSSN_3000DN || scanner_type == AcuantConstants.CSSN_3100 || scanner_type == AcuantConstants.CSSN_3100N)
            {
                ret = true;
            }
            return ret;
        }

        public static bool IsPassportScanner(int scanner_type)
        {
            bool ret = false;
            if ((scanner_type == AcuantConstants.CSSN_1000 || scanner_type == AcuantConstants.CSSN_1000N || scanner_type == AcuantConstants.CSSN_PASS ||
               scanner_type == AcuantConstants.CSSN_PASS_R2))
            {
                ret = true;
            }
            return ret;
        }

        public static string GetImageFromBuffer(string imagebuffer)
        {
            try
            {
                byte[] imgBuffer;
                // If image buffer found process buffer
                if (imagebuffer != null)
                {
                    // Change image buffer to byte[] to be  able to save in DataBase.
                    char[] tempBuffer = imagebuffer.ToCharArray();
                    byte[] imageDataBuffer = new byte[tempBuffer.Length];
                    for (int i = 0; i < tempBuffer.Length; i++)
                    {
                        imageDataBuffer[i] = (byte)tempBuffer[i];
                    }
                    imgBuffer = imageDataBuffer;
                    return Convert.ToBase64String(imgBuffer);
                }
                else
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public static string GetImageFromFile(NetScanW.CImageClass _image, NetScanWex.CImageClass _imageEx, string filePath)
        {
            if (!File.Exists(filePath))
                return null;
            if (Path.GetExtension(filePath)[1] == 'e')
            {
                return GetImageFromFileEx(_image, _imageEx, filePath);
            }
            FileStream fs = new FileStream(filePath, FileMode.Open);

            byte[] imgBuffer = new byte[fs.Length];
            // reading the data
            fs.Read(imgBuffer, 0, imgBuffer.Length);

            fs.Close();
            fs = null;
            return Convert.ToBase64String(imgBuffer);
        }

        public static string GetImageFromFileEx(NetScanW.CImageClass _image, NetScanWex.CImageClass _imageEx, string filePath)
        {
            string tmpFile;
            tmpFile = Path.GetFullPath(filePath);
            tmpFile = tmpFile.Replace(Path.GetFileName(filePath), "tmpImage.jpg");
            _image.ConvertImage(filePath, tmpFile);
            FileStream fs = new FileStream(tmpFile, FileMode.Open);

            byte[] imgBuffer = new byte[fs.Length];
            // reading the data
            fs.Read(imgBuffer, 0, imgBuffer.Length);

            fs.Close();
            fs = null;
            File.Delete(tmpFile);
            return Convert.ToBase64String(imgBuffer);
        }
    }
}
