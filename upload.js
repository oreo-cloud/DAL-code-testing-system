const fs = require('fs');
require('dotenv').config();
const path = require('path');
const uuid = require('uuid');
const { exec } = require('child_process');


async function execute(input_dir, homework_name) {
    const all_promise = [];

    const files = await fs.promises.readdir(path.join(input_dir, homework_name));

    // 只取出cpp檔案
    const cpp_files = files.filter(file => file.endsWith('.cpp'));

    for (const cpp_file of cpp_files) {
        // 取出檔案名稱
        const pure_cpp_file_name = path.parse(cpp_file).name;

        all_promise.push(() => new Promise(async (resolve, reject) => {
            // 編譯程式
            exec('cd ' + path.join('DS_source', homework_name) + ' && g++ ' + cpp_file + ' -o ' + path.join( `../../DS_exe/${homework_name}`, pure_cpp_file_name ), (error, stdout, stderr) => {
                if (error) {
                    console.log('error: ' + error.message);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.log('stderr: ' + stderr);
                    reject(error);
                    return;
                }

            });

            resolve();

        }));

    }

    return all_promise;
    

}

async function check_file_existence() {

    const all_files = await fs.promises.readdir(path.join('DS_source', 'upload'));
    regex_input = /^(input|pairs)\d{3}\.(txt|bin)$/;
    regex_cpp_soft = /(DEMO[a-z]{1}|QUIZ[a-z]{1}).cpp$/;
    flex_regex_cpp_soft = /(DEMO|QUIZ).cpp$/;
    regex_cpp_speed = /(SLOW|BEST)[a-z]{1}.cpp/;

    // 分類檔案
    for (const file of all_files) {
        if (regex_input.test(file)) {
            // 檢查relation file是否存在
            ;
        }

        else if (flex_regex_cpp_soft.test(file)) {
            // 檔名改成DEMOa.cpp, DEMOb.cpp
            let new_file_name_a ;
            let new_file_name_b ;

            if (file === "DEMO.cpp" ) {
                new_file_name_a = "DEMOa.cpp";
                new_file_name_b = "DEMOb.cpp";
            }

            else if (file === "QUIZ.cpp") {
                new_file_name_a = "QUIZa.cpp";
                new_file_name_b = "QUIZb.cpp";
            }

            else {
                throw new Error(`檔案格式錯誤: ${file}`);
            }

            await fs.promises.copyFile(path.join('DS_source', 'upload', file), path.join('DS_source', 'upload', new_file_name_a));
            await fs.promises.copyFile(path.join('DS_source', 'upload', file), path.join('DS_source', 'upload', new_file_name_b));
            await fs.promises.rm(path.join('DS_source', 'upload', file));
        }

        else if (regex_cpp_soft.test(file)) {
            ;
        }
        

        else if (regex_cpp_speed.test(file)) {
            ;
        }

        else {
            throw new Error(`檔案格式錯誤: ${file}`);
        }
    }
}

exports.check_file = check_file_existence;
exports.execute = execute;
