const fs=require('fs'),path=require('path'),childProcess=require('child_process');
jest.mock('child_process',()=>({execFile:jest.fn()}));
const {OfficialContractDocument}=require('../dist/src/contracts/documents/official-contract-document.js');

describe('PDF converter fallback chain',()=>{
 const previousPath=process.env.LIBREOFFICE_PATH;
 beforeEach(()=>{childProcess.execFile.mockReset();delete process.env.LIBREOFFICE_PATH;});
 afterAll(()=>{if(previousPath===undefined)delete process.env.LIBREOFFICE_PATH;else process.env.LIBREOFFICE_PATH=previousPath;});

 test('LibreOffice available returns a valid PDF and removes its temp directory',async()=>{
  process.env.LIBREOFFICE_PATH='fake-soffice';const expected=Buffer.from('%PDF-1.7 libreoffice');let tempDir='';
  childProcess.execFile.mockImplementation((file,args,_options,callback)=>{expect(file).toBe('fake-soffice');expect(args.slice(0,4)).toEqual(['--headless','--convert-to','pdf','--outdir']);tempDir=args[4];fs.writeFileSync(path.join(tempDir,'contract.pdf'),expected);callback(null,'','');});
  await expect(new OfficialContractDocument().pdf(Buffer.from('docx'))).resolves.toEqual(expected);expect(fs.existsSync(tempDir)).toBe(false);expect(childProcess.execFile).toHaveBeenCalledTimes(1);
 });

 test('LibreOffice failure falls back to Word output',async()=>{
  process.env.LIBREOFFICE_PATH='fake-soffice';childProcess.execFile.mockImplementation((_file,_args,_options,callback)=>callback(new Error('LibreOffice failed')));const document=new OfficialContractDocument(),expected=Buffer.from('%PDF-1.7 word');
  const word=jest.spyOn(document,'convertWithWord').mockImplementation(async(_input,output)=>{fs.writeFileSync(output,expected);return true;});
  await expect(document.pdf(Buffer.from('docx'))).resolves.toEqual(expected);expect(word).toHaveBeenCalledTimes(1);
 });

 test('LibreOffice unavailable attempts Word',async()=>{
  const document=new OfficialContractDocument();jest.spyOn(document,'libreOfficeCandidates').mockReturnValue([]);const word=jest.spyOn(document,'convertWithWord').mockImplementation(async(_input,output)=>{fs.writeFileSync(output,Buffer.from('%PDF word'));return true;});
  await expect(document.pdf(Buffer.from('docx'))).resolves.toEqual(Buffer.from('%PDF word'));expect(word).toHaveBeenCalledTimes(1);
 });

 test('both converters failing returns the final neutral error',async()=>{
  const document=new OfficialContractDocument();jest.spyOn(document,'libreOfficeCandidates').mockReturnValue([]);jest.spyOn(document,'convertWithWord').mockResolvedValue(false);
  await expect(document.pdf(Buffer.from('docx'))).rejects.toMatchObject({message:'No se pudo generar el PDF. Verifique que LibreOffice o Microsoft Word estén disponibles en el servidor.'});
 });

 test('an empty PDF is rejected and its temp directory is removed',async()=>{
  process.env.LIBREOFFICE_PATH='fake-soffice';let tempDir='';childProcess.execFile.mockImplementation((_file,args,_options,callback)=>{tempDir=args[4];fs.writeFileSync(path.join(tempDir,'contract.pdf'),Buffer.alloc(0));callback(null,'','');});const document=new OfficialContractDocument();jest.spyOn(document,'convertWithWord').mockResolvedValue(false);
  await expect(document.pdf(Buffer.from('docx'))).rejects.toMatchObject({status:503});expect(fs.existsSync(tempDir)).toBe(false);
 });

 test('Word cleanup error still returns a PDF already exported',async()=>{
  const document=new OfficialContractDocument();jest.spyOn(document,'libreOfficeCandidates').mockReturnValue([]);const expected=Buffer.from('%PDF-1.7 generated');
  childProcess.execFile.mockImplementation((_file,args,_options,callback)=>{const output=args[args.indexOf('-OutputPath')+1];fs.writeFileSync(output,expected);callback(new Error('TYPE_E_ELEMENTNOTFOUND en Word.Application.Quit'));});
  await expect(document.pdf(Buffer.from('docx'))).resolves.toEqual(expected);
 });
});
